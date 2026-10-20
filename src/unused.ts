import * as vscode from 'vscode';
import { Definition, getDefinitions } from './tokens';
import { getWorkspaceIndex } from './workspaceVars';

/** Names of `tokens` that are in no `used` set and not referenced by the value of another token. */
export function findUnused(tokens: Map<string, Definition[]>, used: Set<string>): Map<string, Definition[]> {
    const referenced = new Set(used);
    for (const defs of tokens.values()) {
        for (const d of defs) {
            for (const m of d.value.matchAll(/var\(\s*(--[\w-]+)/g)) {
                referenced.add(m[1]);
            }
        }
    }
    return new Map([...tokens].filter(([name]) => !referenced.has(name)));
}

/** Every token of every workspace folder, merged by name. */
async function allTokens() {
    const all = new Map<string, Definition[]>();
    for (const folder of vscode.workspace.workspaceFolders ?? []) {
        for (const [name, defs] of await getDefinitions(folder.uri)) {
            const seen = all.get(name) ?? [];
            all.set(name, [...seen, ...defs.filter((d) => !seen.some((s) => s.uri.toString() === d.uri.toString() && s.line === d.line))]);
        }
    }
    return all;
}

/** Lists the tokens that no file of the workspace refers to; picking one opens its declaration. */
export async function showUnusedTokens() {
    const tokens = await allTokens();
    if (!tokens.size) {
        vscode.window.showInformationMessage('VarScout: no token files found. Check the cssTokens.files setting.');
        return;
    }
    const unused = findUnused(tokens, (await getWorkspaceIndex()).used);
    if (!unused.size) {
        vscode.window.showInformationMessage(`VarScout: all ${tokens.size} tokens are used.`);
        return;
    }
    const byFile = new Map<string, Definition[]>();
    for (const defs of unused.values()) {
        const file = vscode.workspace.asRelativePath(defs[0].uri);
        byFile.set(file, [...(byFile.get(file) ?? []), defs[0]]);
    }
    const items: (vscode.QuickPickItem & { def?: Definition })[] = [];
    for (const [file, defs] of byFile) {
        items.push({ label: file, kind: vscode.QuickPickItemKind.Separator });
        items.push(...defs.map((def) => ({ label: def.name, description: def.value, def })));
    }
    const pick = await vscode.window.showQuickPick(items, {
        title: `VarScout: ${unused.size} of ${tokens.size} tokens are never used`,
        placeHolder: 'Pick one to open its declaration',
        matchOnDescription: true,
    });
    if (pick?.def) {
        const { uri, line, column, name } = pick.def;
        await vscode.window.showTextDocument(uri, { selection: new vscode.Range(line, column, line, column + name.length) });
    }
}
