import * as vscode from 'vscode';
import { tokenCompletionProvider } from './completion';
import { invalidateTokens, readTokenFile } from './tokens';
import { getTokenFiles, watchTokenFiles } from './tokenFiles';

export function activate(context: vscode.ExtensionContext) {
    const out = vscode.window.createOutputChannel('VarScout');

    context.subscriptions.push(
        out,
        vscode.languages.registerCompletionItemProvider(
            ['css', 'scss', 'less', 'vue', 'svelte', 'astro'].map((language) => ({ language })),
            tokenCompletionProvider,
            '-',
            '(',
        ),
        watchTokenFiles(invalidateTokens),
        // Debug aid: dumps what the parser extracted from every configured token file.
        vscode.commands.registerCommand('varscout.showTokens', async () => {
            out.clear();
            for (const uri of await getTokenFiles()) {
                out.appendLine(`# ${vscode.workspace.asRelativePath(uri)}`);
                try {
                    (await readTokenFile(uri)).forEach((t) => out.appendLine(`${t.name}: ${t.value}`));
                } catch (e) {
                    out.appendLine(`! parse error: ${e instanceof Error ? e.message : e}`);
                }
            }
            out.show(true);
        }),
    );
}

export function deactivate() {}
