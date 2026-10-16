import * as vscode from 'vscode';
import { parseTokens, Token } from './parser';
import { getTokenFiles } from './tokenFiles';

export async function readTokenFile(uri: vscode.Uri): Promise<Token[]> {
    return parseTokens(new TextDecoder().decode(await vscode.workspace.fs.readFile(uri)));
}

interface Store {
    /** First definition of each token. */
    first: Map<string, Token>;
    /** Every definition of each token, in source order (redefinitions under themes, media queries...). */
    all: Map<string, Token[]>;
}

let cache: Promise<Store> | undefined;

/** The first definition of each configured token, by name. Cached until `invalidateTokens()`. */
export async function getTokens(): Promise<Map<string, Token>> {
    return (await (cache ??= load())).first;
}

/** Every definition of each token, by name. */
export async function getDefinitions(): Promise<Map<string, Token[]>> {
    return (await (cache ??= load())).all;
}

export function invalidateTokens() {
    cache = undefined;
}

async function load(): Promise<Store> {
    const store: Store = { first: new Map(), all: new Map() };
    for (const uri of await getTokenFiles()) {
        try {
            for (const t of await readTokenFile(uri)) {
                // ponytail: completion uses the first definition; hover lists all. Per-theme labels come with theme awareness.
                if (!store.first.has(t.name)) {
                    store.first.set(t.name, t);
                }
                store.all.set(t.name, [...(store.all.get(t.name) ?? []), t]);
            }
        } catch (e) {
            console.warn(`[varscout] skipping ${uri.fsPath}:`, e);
        }
    }
    return store;
}
