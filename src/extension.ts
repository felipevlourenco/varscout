import * as vscode from 'vscode';
import { tokenCompletionProvider } from './completion';
import { tokenDefinitionProvider } from './definition';
import { startDiagnostics } from './diagnostics';
import { tokenHoverProvider } from './hover';
import { SELECTOR } from './languages';
import { hardcodedValueFixes } from './quickfix';
import { forgetFile, invalidateTokens, readTokenFile } from './tokens';
import { getTokenFiles, watchTokenFiles } from './tokenFiles';
import { showUnusedTokens } from './unused';
import { invalidateWorkspaceVars, watchWorkspaceVars } from './workspaceVars';

export function activate(context: vscode.ExtensionContext) {
    const out = vscode.window.createOutputChannel('VarScout');
    const diagnostics = startDiagnostics();
    const reload = (changed?: vscode.Uri) => {
        if (changed) {
            forgetFile(changed); // a watcher saw it change: don't trust the modification-time check
        }
        invalidateTokens();
        invalidateWorkspaceVars(); // the set of token files may have changed
        diagnostics.refreshAll();
    };

    context.subscriptions.push(
        out,
        diagnostics,
        vscode.languages.registerCompletionItemProvider(SELECTOR, tokenCompletionProvider, '-', '('),
        vscode.languages.registerHoverProvider(SELECTOR, tokenHoverProvider),
        vscode.languages.registerDefinitionProvider(SELECTOR, tokenDefinitionProvider),
        vscode.languages.registerCodeActionsProvider(SELECTOR, hardcodedValueFixes, {
            providedCodeActionKinds: [vscode.CodeActionKind.QuickFix],
        }),
        watchTokenFiles(reload),
        watchWorkspaceVars(() => diagnostics.refreshAll()),
        // Files inside node_modules aren't watched by VS Code, so changes after an install need this.
        vscode.commands.registerCommand('varscout.reloadTokens', () => {
            invalidateWorkspaceVars(true);
            reload();
        }),
        vscode.commands.registerCommand('varscout.showUnusedTokens', showUnusedTokens),
        // Debug aid: dumps what the parser extracted from every configured token file.
        vscode.commands.registerCommand('varscout.showTokens', async () => {
            out.clear();
            for (const folder of vscode.workspace.workspaceFolders ?? [undefined]) {
                if (folder && vscode.workspace.workspaceFolders!.length > 1) {
                    out.appendLine(`## ${folder.name}`);
                }
                for (const uri of await getTokenFiles(folder)) {
                    out.appendLine(`# ${vscode.workspace.asRelativePath(uri)}`);
                    try {
                        (await readTokenFile(uri)).forEach((t) => out.appendLine(`${t.name}: ${t.value}`));
                    } catch (e) {
                        out.appendLine(`! parse error: ${e instanceof Error ? e.message : e}`);
                    }
                }
            }
            out.show(true);
        }),
    );
}

export function deactivate() {}
