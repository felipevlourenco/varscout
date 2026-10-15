import * as vscode from 'vscode';
import { parseTokens, Token } from './parser';
import { getTokenFiles } from './tokenFiles';

export async function readTokenFile(uri: vscode.Uri): Promise<Token[]> {
    return parseTokens(new TextDecoder().decode(await vscode.workspace.fs.readFile(uri)));
}

let cache: Promise<Map<string, Token>> | undefined;

/** All tokens from the configured files, by name. Cached until `invalidateTokens()`. */
export function getTokens(): Promise<Map<string, Token>> {
    return (cache ??= load());
}

export function invalidateTokens() {
    cache = undefined;
}

async function load() {
    const tokens = new Map<string, Token>();
    for (const uri of await getTokenFiles()) {
        try {
            // ponytail: first definition wins; per-theme values come with the theme-awareness item.
            for (const t of await readTokenFile(uri)) {
                if (!tokens.has(t.name)) {
                    tokens.set(t.name, t);
                }
            }
        } catch (e) {
            console.warn(`[varscout] skipping ${uri.fsPath}:`, e);
        }
    }
    return tokens;
}
