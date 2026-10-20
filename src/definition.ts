import * as vscode from 'vscode';
import { getDefinitions } from './tokens';
import { varNameAt } from './usage';
import { getWorkspaceIndex } from './workspaceVars';

/**
 * Cmd/Ctrl+click on `var(--x)` jumps to every declaration of `--x` in the token files (VS Code shows a list if there are several),
 * or, for a name that isn't a token, to where else in the workspace it is declared.
 */
export const tokenDefinitionProvider: vscode.DefinitionProvider = {
    async provideDefinition(document, position) {
        const usage = varNameAt(document, position);
        if (!usage) {
            return undefined;
        }
        const tokens = (await getDefinitions(document.uri)).get(usage.name);
        const definitions = tokens ?? (await getWorkspaceIndex()).declarations.get(usage.name) ?? [];
        return definitions.map<vscode.LocationLink>((d) => {
            const target = new vscode.Range(d.line, d.column, d.line, d.column + usage.name.length);
            return {
                originSelectionRange: usage.range,
                targetUri: d.uri,
                targetRange: target,
                targetSelectionRange: target,
            };
        });
    },
};
