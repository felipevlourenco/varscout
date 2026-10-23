import * as vscode from 'vscode';
import { cssRegions, SCRIPT, SELECTOR } from './languages';
import { getDefinitions } from './tokens';
import { getWorkspaceIndex } from './workspaceVars';

const blank = (css: string, lineComments: boolean) =>
    css.replace(lineComments ? /\/\*[\s\S]*?\*\/|(?<![:\w])\/\/[^\n]*/g : /\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));

/**
 * Text from `from` up to the first character of `stops` outside brackets and strings (or an unmatched closing bracket),
 * with one pair of surrounding quotes removed. Long values are cut off.
 */
function valueFrom(text: string, from: number, stops: string): string {
    let depth = 0;
    let quote = '';
    let j = from;
    for (; j < text.length && j - from < 300; j++) {
        const c = text[j];
        if (quote) {
            j += c === '\\' ? 1 : 0;
            quote = c === quote ? '' : quote;
        } else if ('"\'`'.includes(c)) {
            quote = c;
        } else if ('([{'.includes(c)) {
            depth++;
        } else if (')]}'.includes(c)) {
            if (!depth--) {
                break;
            }
        } else if (!depth && stops.includes(c)) {
            break;
        }
    }
    return text.slice(from, j).trim().replace(/^(["'`])(.*)\1$/s, '$2');
}

/**
 * `var(--x` usages and `--x:` declarations in `css` (each with the offset of the name, declarations also with their value),
 * ignoring comments.
 */
export function scanVars(css: string, lineComments = false) {
    const text = blank(css, lineComments);
    const usages = [...text.matchAll(/var\(\s*(--[\w-]+)/g)].map((m) => ({
        name: m[1],
        index: m.index + m[0].length - m[1].length,
    }));
    // `--x:` in CSS, `'--x':` in style objects, `style.setProperty('--x', ...)` in scripts.
    const declarations = [...text.matchAll(/(--[\w-]+)(['"]?)\s*:|setProperty\(\s*['"`](--[\w-]+)/g)].map((m) => {
        const name = m[1] ?? m[3];
        const end = m.index + m[0].length;
        let value: string;
        if (m[1] === undefined) {
            const comma = /^['"`]\s*,/.exec(text.slice(end));
            value = comma ? valueFrom(text, end + comma[0].length, '') : '';
        } else {
            value = valueFrom(text, end, m[2] ? ',' : ';'); // a quoted key is a style object: the value ends at the comma
        }
        return { name, index: m.index + m[0].indexOf(name), value };
    });
    return { usages, declarations, declared: new Set(declarations.map((d) => d.name)) };
}

/** Warns on `var(--x)` where `--x` is in none of the token files and isn't declared in this file or anywhere else in the workspace. */
export function startDiagnostics(): vscode.Disposable & { refreshAll(): void } {
    const collection = vscode.languages.createDiagnosticCollection('VarScout');

    const latest = new Map<string, number>(); // newest update per document: an older one finishing late must not overwrite it
    let counter = 0;

    async function update(doc: vscode.TextDocument) {
        if (!['file', 'untitled'].includes(doc.uri.scheme) || vscode.languages.match(SELECTOR, doc) === 0) {
            return;
        }
        const key = doc.uri.toString();
        const id = ++counter;
        latest.set(key, id);
        const known = await getDefinitions(doc.uri);
        const elsewhere = (await getWorkspaceIndex()).declarations;
        if (latest.get(key) !== id) {
            return;
        }
        if (!known.size) {
            collection.delete(doc.uri); // no token files found: everything would look unknown
            return;
        }
        const text = doc.getText();
        const lineComments = ['scss', 'less', ...SCRIPT].includes(doc.languageId);
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
                .filter((u) => !known.has(u.name) && !declared.has(u.name) && !elsewhere.has(u.name))
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
        vscode.workspace.onDidCloseTextDocument((d) => {
            latest.delete(d.uri.toString());
            collection.delete(d.uri);
        }),
    );
    refreshAll();
    return { refreshAll, dispose: () => subscriptions.dispose() };
}
