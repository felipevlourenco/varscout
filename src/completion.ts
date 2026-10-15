import * as vscode from 'vscode';
import { getTokens } from './tokens';

/** Where the token name being typed starts in `linePrefix`, or undefined if tokens shouldn't be offered here. */
export function completionContext(linePrefix: string): { start: number } | undefined {
    // Inside `var(` (name may be empty), or a word starting with `--`.
    const m = /var\(\s*([\w-]*)$/.exec(linePrefix) ?? /(?:^|[^\w-])(--[\w-]*)$/.exec(linePrefix);
    if (!m) {
        return undefined;
    }
    const start = linePrefix.length - m[1].length;
    // `--` at the start of a declaration is a new property name, not a usage.
    return /(^|[{;])\s*$/.test(linePrefix.slice(0, start)) ? undefined : { start };
}

export const tokenCompletionProvider: vscode.CompletionItemProvider = {
    async provideCompletionItems(document, position) {
        const ctx = completionContext(document.lineAt(position).text.slice(0, position.character));
        if (!ctx) {
            return undefined;
        }
        const range = new vscode.Range(position.line, ctx.start, position.line, position.character);
        return [...(await getTokens()).values()].map((t) => {
            const item = new vscode.CompletionItem(t.name, vscode.CompletionItemKind.Variable);
            item.detail = t.value;
            item.range = range;
            return item;
        });
    },
};
