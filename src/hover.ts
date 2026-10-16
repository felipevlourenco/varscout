import * as vscode from 'vscode';
import { resolveValue } from './resolve';
import { getDefinitions, getTokens } from './tokens';
import { varNameAt } from './usage';

export const tokenHoverProvider: vscode.HoverProvider = {
    async provideHover(document, position) {
        const usage = varNameAt(document, position);
        if (!usage) {
            return undefined;
        }
        const { name, range } = usage;
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
