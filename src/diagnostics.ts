import * as vscode from 'vscode';
import { cssRegions, SELECTOR } from './languages';
import { getDefinitions } from './tokens';

const blank = (css: string, lineComments: boolean) =>
    css.replace(lineComments ? /\/\*[\s\S]*?\*\/|(?<![:\w])\/\/[^\n]*/g : /\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));

/** `var(--x` usages (with the offset of the name) and `--x:` declarations in `css`, ignoring comments. */
export function scanVars(css: string, lineComments = false) {
    const text = blank(css, lineComments);
    const usages = [...text.matchAll(/var\(\s*(--[\w-]+)/g)].map((m) => ({
        name: m[1],
        index: m.index + m[0].length - m[1].length,
    }));
    const declared = new Set([...text.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
    return { usages, declared };
}

/** Warns on `var(--x)` where `--x` is in none of the token files (and isn't declared in the same file). */
export function startDiagnostics(): vscode.Disposable & { refreshAll(): void } {
    const collection = vscode.languages.createDiagnosticCollection('VarScout');

    async function update(doc: vscode.TextDocument) {
        if (!['file', 'untitled'].includes(doc.uri.scheme) || vscode.languages.match(SELECTOR, doc) === 0) {
            return;
        }
        const known = await getDefinitions();
        if (!known.size) {
            collection.delete(doc.uri); // no token files found: everything would look unknown
            return;
        }
        const text = doc.getText();
        const lineComments = ['scss', 'less'].includes(doc.languageId);
        const declared = new Set<string>();
        const usages: { name: string; index: number }[] = [];
        for (const { start, end } of cssRegions(text, doc.languageId)) {
            const found = scanVars(text.slice(start, end), lineComments);
            found.declared.forEach((n) => declared.add(n));
            usages.push(...found.usages.map((u) => ({ name: u.name, index: u.index + start })));
        }
        collection.set(
            doc.uri,
            usages
                .filter((u) => !known.has(u.name) && !declared.has(u.name))
                .map((u) => {
                    const range = new vscode.Range(doc.positionAt(u.index), doc.positionAt(u.index + u.name.length));
                    const d = new vscode.Diagnostic(range, `Unknown CSS variable "${u.name}"`, vscode.DiagnosticSeverity.Warning);
                    d.source = 'VarScout';
                    return d;
                }),
        );
    }

    const refreshAll = () => vscode.workspace.textDocuments.forEach(update);
    const subscriptions = vscode.Disposable.from(
        collection,
        vscode.workspace.onDidOpenTextDocument(update),
        vscode.workspace.onDidChangeTextDocument((e) => update(e.document)),
        vscode.workspace.onDidCloseTextDocument((d) => collection.delete(d.uri)),
    );
    refreshAll();
    return { refreshAll, dispose: () => subscriptions.dispose() };
}
