import * as path from 'path';
import * as vscode from 'vscode';

const DEFAULT_FILES = ['**/tokens.css'];

/** `cssTokens.files` as set for `folder` (a folder's own `.vscode/settings.json` can override the workspace's). */
const patterns = (folder?: vscode.WorkspaceFolder) =>
    vscode.workspace.getConfiguration('cssTokens', folder?.uri).get<string[]>('files', DEFAULT_FILES);

const hasGlob = (p: string) => /[*?{[]/.test(p);

/** `@scope/pkg/file.css` or `pkg/dist/*.css`: not absolute, not `./`, not `**` and no glob in the first segment. */
const isPackageSpec = (p: string) => !/^(\*\*|\.|\/)/.test(p) && !hasGlob(p.split('/')[0]);

/** Files matching `pattern` under `base`. A pattern without glob characters is checked directly, not searched for. */
async function expand(base: vscode.Uri, pattern: string, skipNodeModules: boolean): Promise<vscode.Uri[]> {
    if (!hasGlob(pattern)) {
        const uri = vscode.Uri.joinPath(base, pattern);
        try {
            return (await vscode.workspace.fs.stat(uri)).type & vscode.FileType.File ? [uri] : [];
        } catch {
            return [];
        }
    }
    return vscode.workspace.findFiles(new vscode.RelativePattern(base, pattern), skipNodeModules ? '**/node_modules/**' : null);
}

/**
 * Resolves `cssTokens.files` of one workspace folder (default: the first) to unique file URIs. Each entry is, in order:
 * - an absolute path;
 * - a path or glob relative to each workspace folder (`node_modules` is skipped unless the entry names it);
 * - a package file such as `@acme/tokens/dist/tokens.css`, looked up like Node does: in the nearest
 *   `node_modules` of the workspace folder or one of its parents.
 */
export async function getTokenFiles(folder = vscode.workspace.workspaceFolders?.[0]): Promise<vscode.Uri[]> {
    const found = new Map<string, vscode.Uri>();
    const add = (uri: vscode.Uri) => found.set(uri.toString(), uri);

    for (const pattern of patterns(folder)) {
        if (path.isAbsolute(pattern)) {
            add(vscode.Uri.file(pattern));
        } else if (folder) {
            (await expand(folder.uri, pattern, !pattern.includes('node_modules'))).forEach(add);
            if (!isPackageSpec(pattern)) {
                continue;
            }
            for (let dir = folder.uri, parent = dir; ; dir = parent) {
                const hits = await expand(vscode.Uri.joinPath(dir, 'node_modules'), pattern, false);
                parent = vscode.Uri.joinPath(dir, '..');
                if (hits.length || parent.path === dir.path) {
                    hits.forEach(add);
                    break;
                }
            }
        }
    }
    return [...found.values()];
}

/**
 * Calls `onChange(file)` when a token file of any workspace folder is created, changed or deleted, and when
 * the setting or the workspace folders change (watchers are rebuilt for the new patterns).
 * Only saved changes are seen: unsaved edits in an open token file don't count.
 */
export function watchTokenFiles(onChange: (changed?: vscode.Uri) => void): vscode.Disposable {
    let watchers: vscode.FileSystemWatcher[] = [];
    const rebuild = () => {
        watchers.forEach((w) => w.dispose());
        const folders = vscode.workspace.workspaceFolders ?? [undefined];
        watchers = folders
            .flatMap((folder) =>
                patterns(folder).flatMap((pattern) =>
                    path.isAbsolute(pattern)
                        ? [new vscode.RelativePattern(vscode.Uri.file(path.dirname(pattern)), path.basename(pattern))]
                        : folder
                          ? [new vscode.RelativePattern(folder, pattern)]
                          : [],
                ),
            )
            .map((glob) => {
                const w = vscode.workspace.createFileSystemWatcher(glob);
                w.onDidCreate(onChange);
                w.onDidChange(onChange);
                w.onDidDelete(onChange);
                return w;
            });
    };
    const reset = () => {
        rebuild();
        onChange();
    };
    rebuild();

    const subscriptions = [
        vscode.workspace.onDidChangeConfiguration((e) => e.affectsConfiguration('cssTokens.files') && reset()),
        vscode.workspace.onDidChangeWorkspaceFolders(reset),
    ];
    return new vscode.Disposable(() => [...watchers, ...subscriptions].forEach((d) => d.dispose()));
}
