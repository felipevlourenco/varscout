import * as path from 'path';
import * as vscode from 'vscode';

const DEFAULT_FILES = ['**/tokens.css'];

const patterns = () => vscode.workspace.getConfiguration('cssTokens').get<string[]>('files', DEFAULT_FILES);

/** Resolves `cssTokens.files` (globs relative to each workspace folder, or absolute paths) to unique file URIs. */
export async function getTokenFiles(): Promise<vscode.Uri[]> {
    const found = new Map<string, vscode.Uri>();
    const add = (uri: vscode.Uri) => found.set(uri.toString(), uri);

    for (const pattern of patterns()) {
        if (path.isAbsolute(pattern)) {
            add(vscode.Uri.file(pattern));
            continue;
        }
        for (const folder of vscode.workspace.workspaceFolders ?? []) {
            const matches = await vscode.workspace.findFiles(
                new vscode.RelativePattern(folder, pattern),
                '**/node_modules/**',
            );
            matches.forEach(add);
        }
    }
    return [...found.values()];
}

/**
 * Calls `onChange` when a token file is created, changed or deleted, and when the setting or
 * the workspace folders change (watchers are rebuilt for the new patterns).
 * Only saved changes are seen: unsaved edits in an open token file don't count.
 */
export function watchTokenFiles(onChange: () => void): vscode.Disposable {
    let watchers: vscode.FileSystemWatcher[] = [];
    const rebuild = () => {
        watchers.forEach((w) => w.dispose());
        watchers = patterns()
            .flatMap((pattern) =>
                path.isAbsolute(pattern)
                    ? [new vscode.RelativePattern(vscode.Uri.file(path.dirname(pattern)), path.basename(pattern))]
                    : (vscode.workspace.workspaceFolders ?? []).map((f) => new vscode.RelativePattern(f, pattern)),
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
