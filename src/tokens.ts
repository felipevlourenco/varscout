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

const stores = new Map<string, Promise<Store>>();

/** The workspace folder `uri` is in; files outside any folder (and untitled documents) use the first folder. */
const folderFor = (uri?: vscode.Uri) => (uri && vscode.workspace.getWorkspaceFolder(uri)) || vscode.workspace.workspaceFolders?.[0];

/** Tokens are per workspace folder, since each folder can configure its own token files. */
function store(uri?: vscode.Uri) {
    const folder = folderFor(uri);
    const key = folder?.uri.toString() ?? '';
    let s = stores.get(key);
    if (!s) {
        stores.set(key, (s = load(folder)));
    }
    return s;
}

/** The no-theme definition of each token available to the file `uri`, by name. Cached until `invalidateTokens()`. */
export async function getTokens(uri?: vscode.Uri): Promise<Map<string, Token>> {
    return (await store(uri)).themes.get('default')!;
}

/** Every definition of each token available to the file `uri`, by name. */
export async function getDefinitions(uri?: vscode.Uri): Promise<Map<string, Definition[]>> {
    return (await store(uri)).all;
}

export async function getThemes(uri?: vscode.Uri): Promise<ThemeMaps> {
    return (await store(uri)).themes;
}

export function invalidateTokens() {
    stores.clear();
}

async function load(folder?: vscode.WorkspaceFolder): Promise<Store> {
    const all = new Map<string, Definition[]>();
    for (const uri of await getTokenFiles(folder)) {
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
