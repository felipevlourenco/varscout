import * as vscode from 'vscode';
import { getDefinitions } from './tokens';
import { varNameAt } from './usage';

/** Cmd/Ctrl+click on `var(--x)` jumps to every declaration of `--x` (VS Code shows a list if there are several). */
export const tokenDefinitionProvider: vscode.DefinitionProvider = {
    async provideDefinition(document, position) {
        const usage = varNameAt(document, position);
        if (!usage) {
            return undefined;
        }
        const definitions = (await getDefinitions(document.uri)).get(usage.name) ?? [];
        return definitions.map<vscode.LocationLink>((d) => {
            const target = new vscode.Range(d.line, d.column, d.line, d.column + d.name.length);
            return {
                originSelectionRange: usage.range,
                targetUri: d.uri,
                targetRange: target,
                targetSelectionRange: target,
            };
        });
    },
};
