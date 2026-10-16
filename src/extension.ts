import * as vscode from 'vscode';
import { tokenCompletionProvider } from './completion';
import { tokenDefinitionProvider } from './definition';
import { startDiagnostics } from './diagnostics';
import { tokenHoverProvider } from './hover';
import { SELECTOR } from './languages';
import { hardcodedValueFixes } from './quickfix';
import { invalidateTokens, readTokenFile } from './tokens';
import { getTokenFiles, watchTokenFiles } from './tokenFiles';

export function activate(context: vscode.ExtensionContext) {
    const out = vscode.window.createOutputChannel('VarScout');
    const diagnostics = startDiagnostics();

    context.subscriptions.push(
        out,
        diagnostics,
        vscode.languages.registerCompletionItemProvider(SELECTOR, tokenCompletionProvider, '-', '('),
        vscode.languages.registerHoverProvider(SELECTOR, tokenHoverProvider),
        vscode.languages.registerDefinitionProvider(SELECTOR, tokenDefinitionProvider),
        vscode.languages.registerCodeActionsProvider(SELECTOR, hardcodedValueFixes, {
            providedCodeActionKinds: [vscode.CodeActionKind.QuickFix],
        }),
        watchTokenFiles(() => {
            invalidateTokens();
            diagnostics.refreshAll();
        }),
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
