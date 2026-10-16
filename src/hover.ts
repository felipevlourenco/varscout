import * as vscode from 'vscode';
import { inCss } from './languages';
import { resolveValue } from './resolve';
import { getDefinitions, getTokens } from './tokens';

export const tokenHoverProvider: vscode.HoverProvider = {
    async provideHover(document, position) {
        const range = document.getWordRangeAtPosition(position, /--[\w-]+/);
        if (!range || !inCss(document, position)) {
            return undefined;
        }
        // Only usages: the name must be the first argument of a `var(`.
        const before = document.lineAt(range.start).text.slice(0, range.start.character);
        if (!/var\(\s*$/.test(before)) {
            return undefined;
        }
        const name = document.getText(range);
        const definitions = (await getDefinitions()).get(name);
        if (!definitions) {
            return undefined;
        }
        const tokens = await getTokens();
        const resolved = definitions.map((d) => resolveValue(d.value, tokens, name));
        const md = new vscode.MarkdownString();
        md.appendCodeblock(resolved.map((r) => `${name}: ${r.value};`).join('\n'), 'css');
        if (resolved[0].chain.length) {
            md.appendMarkdown([name, ...resolved[0].chain].map((n) => `\`${n}\``).join(' → '));
        }
        return new vscode.Hover(md, range);
    },
};
