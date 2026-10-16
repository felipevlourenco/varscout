import * as vscode from 'vscode';
import { rootFontSize, withPx } from './rem';
import { getThemes } from './tokens';
import { themeValues } from './themes';
import { varNameAt } from './usage';

export const tokenHoverProvider: vscode.HoverProvider = {
    async provideHover(document, position) {
        const usage = varNameAt(document, position);
        if (!usage) {
            return undefined;
        }
        const { name, range } = usage;
        const entries = themeValues(name, await getThemes());
        if (!entries.length) {
            return undefined;
        }
        // Label every line when there's more than one value or the only one isn't the default.
        const labelled = entries.length > 1 || entries[0].theme !== 'default';
        const px = rootFontSize();
        const md = new vscode.MarkdownString();
        md.appendCodeblock(entries.map((e) => `${name}: ${withPx(e.value, px)};${labelled ? ` /* ${e.theme} */` : ''}`).join('\n'), 'css');
        if (entries[0].chain.length) {
            md.appendMarkdown([name, ...entries[0].chain].map((n) => `\`${n}\``).join(' → '));
        }
        return new vscode.Hover(md, range);
    },
};
