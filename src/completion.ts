import * as vscode from 'vscode';
import { inCss } from './languages';
import { resolve } from './resolve';
import { getTokens } from './tokens';

/**
 * Where the token name being typed starts in `linePrefix` and whether it's already inside `var(`,
 * or undefined if tokens shouldn't be offered here.
 */
export function completionContext(linePrefix: string): { start: number; inVar: boolean } | undefined {
    // Inside `var(` (name may be empty), or a word starting with `--`.
    const inVar = /var\(\s*([\w-]*)$/.exec(linePrefix);
    const m = inVar ?? /(?:^|[^\w-])(--[\w-]*)$/.exec(linePrefix);
    if (!m) {
        return undefined;
    }
    const start = linePrefix.length - m[1].length;
    // `--` at the start of a declaration is a new property name, not a usage.
    return /(^|[{;])\s*$/.test(linePrefix.slice(0, start)) ? undefined : { start, inVar: !!inVar };
}

export const isColor = (value: string) =>
    /^(#[\da-f]{3,8}|(rgb|hsl|hwb|lab|lch|oklab|oklch|color)a?\(.*\))$/i.test(value);

export const tokenCompletionProvider: vscode.CompletionItemProvider = {
    async provideCompletionItems(document, position) {
        const ctx = completionContext(document.lineAt(position).text.slice(0, position.character));
        if (!ctx || !inCss(document, position)) {
            return undefined;
        }
        const range = new vscode.Range(position.line, ctx.start, position.line, position.character);
        const tokens = await getTokens();
        return [...tokens.keys()].map((name) => {
            const { value, chain } = resolve(name, tokens);
            const color = isColor(value);
            const item = new vscode.CompletionItem(
                name,
                color ? vscode.CompletionItemKind.Color : vscode.CompletionItemKind.Variable,
            );
            item.detail = value;
            // VS Code draws the swatch from a color at the start of the documentation string
            // (only for #rgb/#rrggbb and comma-style rgb()/hsl(); other formats get the Color icon only).
            const doc = [color ? value : '', chain.length ? `${name} → ${chain.join(' → ')}` : ''].filter(Boolean);
            item.documentation = doc.length ? doc.join('\n\n') : undefined;
            item.insertText = ctx.inVar ? name : `var(${name})`;
            item.range = range;
            return item;
        });
    },
};
