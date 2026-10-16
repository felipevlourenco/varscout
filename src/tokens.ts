import * as vscode from 'vscode';
import { parseTokens, Token } from './parser';
import { getTokenFiles } from './tokenFiles';
import { buildThemeMaps, ThemeMaps } from './themes';

export async function readTokenFile(uri: vscode.Uri): Promise<Token[]> {
    return parseTokens(new TextDecoder().decode(await vscode.workspace.fs.readFile(uri)));
}

/** A token declaration and the file it lives in. */
export interface Definition extends Token {
    uri: vscode.Uri;
}

interface Store {
    /** Every definition of each token, in source order (redefinitions under themes, media queries...). */
    all: Map<string, Definition[]>;
    themes: ThemeMaps<Definition>;
}

let cache: Promise<Store> | undefined;
const store = () => (cache ??= load());

/** The no-theme definition of each token, by name. Cached until `invalidateTokens()`. */
export async function getTokens(): Promise<Map<string, Token>> {
    return (await store()).themes.get('default')!;
}

/** Every definition of each token, by name. */
export async function getDefinitions(): Promise<Map<string, Definition[]>> {
    return (await store()).all;
}

export async function getThemes(): Promise<ThemeMaps> {
    return (await store()).themes;
}

export function invalidateTokens() {
    cache = undefined;
}

async function load(): Promise<Store> {
    const all = new Map<string, Definition[]>();
    for (const uri of await getTokenFiles()) {
        try {
            for (const token of await readTokenFile(uri)) {
                all.set(token.name, [...(all.get(token.name) ?? []), { ...token, uri }]);
            }
        } catch (e) {
            console.warn(`[varscout] skipping ${uri.fsPath}:`, e);
        }
    }
    return { all, themes: buildThemeMaps(all) };
}
