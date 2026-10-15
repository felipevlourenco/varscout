import * as path from 'path';
import * as vscode from 'vscode';

const DEFAULT_FILES = ['**/tokens.css'];

/** Resolves `cssTokens.files` (globs relative to each workspace folder, or absolute paths) to unique file URIs. */
export async function getTokenFiles(): Promise<vscode.Uri[]> {
    const patterns = vscode.workspace
        .getConfiguration('cssTokens')
        .get<string[]>('files', DEFAULT_FILES);

    const found = new Map<string, vscode.Uri>();
    const add = (uri: vscode.Uri) => found.set(uri.toString(), uri);

    for (const pattern of patterns) {
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
