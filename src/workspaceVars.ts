import * as vscode from 'vscode';
import { scanVars } from './diagnostics';
import { cssRegions } from './languages';
import { getTokenFiles } from './tokenFiles';

/** A `--x` declared outside the token files (a stylesheet, a style object in JSX, `setProperty`...). */
export interface VarDecl {
    name: string;
    uri: vscode.Uri;
    /** 0-based position of the name. */
    line: number;
    column: number;
    /** As written in the source (`red`, `${offset}px`); empty when it couldn't be read. */
    value: string;
}

export interface WorkspaceIndex {
    declarations: Map<string, VarDecl[]>;
    /** Names read through `var(--x)` or `getPropertyValue('--x')` anywhere in the workspace. */
    used: Set<string>;
}

const GLOB = '**/*.{css,scss,less,vue,svelte,astro,js,jsx,mjs,cjs,ts,tsx}';
const MAX_FILES = 20000;
const MAX_SIZE = 1_000_000; // bytes; bigger files are bundles or generated code
const LINE_COMMENTS = /\.(scss|less|[cm]?[jt]sx?)$/;

interface FileInfo {
    declarations: VarDecl[];
    used: string[];
}

const files = new Map<string, FileInfo>();
let index: Promise<WorkspaceIndex> | undefined;

async function scanFile(uri: vscode.Uri): Promise<FileInfo> {
    const info: FileInfo = { declarations: [], used: [] };
    try {
        if ((await vscode.workspace.fs.stat(uri)).size > MAX_SIZE) {
            return info;
        }
        const text = new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
        const ext = uri.path.slice(uri.path.lastIndexOf('.') + 1);
        for (const { start, end } of cssRegions(text, ext)) {
            const found = scanVars(text.slice(start, end), LINE_COMMENTS.test(uri.path));
            info.used.push(...found.usages.map((u) => u.name));
            for (const d of found.declarations) {
                const offset = start + d.index;
                const lineStart = text.lastIndexOf('\n', offset - 1) + 1;
                const line = text.slice(0, offset).split('\n').length - 1;
                info.declarations.push({ name: d.name, uri, line, column: offset - lineStart, value: d.value });
            }
        }
        for (const m of text.matchAll(/getPropertyValue\(\s*['"`](--[\w-]+)/g)) {
            info.used.push(m[1]);
        }
    } catch {
        /* unreadable: treat as empty */
    }
    return info;
}

async function build(): Promise<WorkspaceIndex> {
    // Token files are handled per folder by the token store, so they're left out here.
    const tokenFiles = new Set((await Promise.all((vscode.workspace.workspaceFolders ?? []).map((f) => getTokenFiles(f)))).flat().map(String));
    const uris = (await vscode.workspace.findFiles(GLOB, '**/node_modules/**', MAX_FILES)).filter((u) => !tokenFiles.has(u.toString()));
    const todo = uris.filter((u) => !files.has(u.toString()));
    for (let i = 0; i < todo.length; i += 50) {
        await Promise.all(todo.slice(i, i + 50).map(async (u) => files.set(u.toString(), await scanFile(u))));
    }
    const result: WorkspaceIndex = { declarations: new Map(), used: new Set() };
    for (const u of uris) {
        const info = files.get(u.toString())!;
        info.used.forEach((n) => result.used.add(n));
        for (const d of info.declarations) {
            result.declarations.set(d.name, [...(result.declarations.get(d.name) ?? []), d]);
        }
    }
    return result;
}

/**
 * Custom properties declared, and names used, in all the CSS-capable files of the workspace (`node_modules` excluded).
 * Files are scanned once and re-scanned only after a saved change; unsaved edits of other files aren't seen.
 */
export function getWorkspaceIndex(): Promise<WorkspaceIndex> {
    return (index ??= build());
}

/** Calls `onChange` (debounced) after a workspace file was created, saved or deleted. */
export function watchWorkspaceVars(onChange: () => void): vscode.Disposable {
    const watcher = vscode.workspace.createFileSystemWatcher(GLOB);
    let timer: NodeJS.Timeout | undefined;
    const changed = (uri: vscode.Uri) => {
        files.delete(uri.toString());
        index = undefined;
        clearTimeout(timer);
        timer = setTimeout(onChange, 300);
    };
    const subscriptions = [watcher.onDidCreate(changed), watcher.onDidChange(changed), watcher.onDidDelete(changed)];
    return new vscode.Disposable(() => {
        clearTimeout(timer);
        [watcher, ...subscriptions].forEach((d) => d.dispose());
    });
}

/** Re-aggregates on next use (the token files changed); `all` also re-reads every file, e.g. for the "reload" command. */
export function invalidateWorkspaceVars(all = false) {
    if (all) {
        files.clear();
    }
    index = undefined;
}
