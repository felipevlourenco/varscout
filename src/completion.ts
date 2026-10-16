import * as vscode from 'vscode';
import { inCss } from './languages';
import { themeValues } from './themes';
import { getThemes } from './tokens';

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

/** The group a token belongs to: its first name segment, e.g. `color` for `--color-primary` (none for `--primary`). */
export const categoryOf = (name: string) => /^--([^-]+)-./.exec(name)?.[1];

/** Grouped tokens by category (alphabetical), then the ungrouped ones; numbers compare as numbers (`--space-2` < `--space-10`). */
export function sortTokens(names: string[]): string[] {
    const key = (n: string) => (categoryOf(n) ? `0${categoryOf(n)}` : '1');
    return [...names].sort(
        (a, b) => key(a).localeCompare(key(b)) || a.localeCompare(b, undefined, { numeric: true }),
    );
}

export const tokenCompletionProvider: vscode.CompletionItemProvider = {
    async provideCompletionItems(document, position) {
        const ctx = completionContext(document.lineAt(position).text.slice(0, position.character));
        if (!ctx || !inCss(document, position)) {
            return undefined;
        }
        const range = new vscode.Range(position.line, ctx.start, position.line, position.character);
        const themes = await getThemes();
        return sortTokens([...themes.get('default')!.keys()]).map((name, rank) => {
            const entries = themeValues(name, themes);
            const { value, chain } = entries[0];
            const color = isColor(value);
            const category = categoryOf(name);
            // VS Code shows `detail` on the right only for plain string labels; with a label object it shows
            // `description` there instead, so the value has to go into the description next to the category.
            const item = new vscode.CompletionItem(
                category ? { label: name, description: `${category} · ${value}` } : name,
                color ? vscode.CompletionItemKind.Color : vscode.CompletionItemKind.Variable,
            );
            item.sortText = String(rank).padStart(6, '0'); // VS Code sorts by this when the typed text ranks items equally
            item.detail = value;
            // VS Code draws the swatch from a color at the start of the documentation string
            // (only for #rgb/#rrggbb and comma-style rgb()/hsl(); other formats get the Color icon only).
            const doc = [
                color ? value : '',
                chain.length ? `${name} → ${chain.join(' → ')}` : '',
                entries.length > 1 ? entries.map((e) => `${e.theme}: ${e.value}`).join('\n') : '',
            ].filter(Boolean);
            item.documentation = doc.length ? doc.join('\n\n') : undefined;
            item.insertText = ctx.inVar ? name : `var(${name})`;
            item.range = range;
            return item;
        });
    },
};
