import * as vscode from 'vscode';
import { rootFontSize, withPx } from './rem';
import { getThemes } from './tokens';
import { themeValues } from './themes';
import { varNameAt } from './usage';
import { getWorkspaceIndex } from './workspaceVars';

export const tokenHoverProvider: vscode.HoverProvider = {
    async provideHover(document, position) {
        const usage = varNameAt(document, position);
        if (!usage) {
            return undefined;
        }
        const { name, range } = usage;
        const entries = themeValues(name, await getThemes(document.uri));
        if (!entries.length) {
            return elsewhereHover(name, range, document.uri);
        }
        // Label every line when there's more than one value or the only one isn't the default.
        const labelled = entries.length > 1 || entries[0].theme !== 'default';
        const px = rootFontSize(document.uri);
        const md = new vscode.MarkdownString();
        md.appendCodeblock(entries.map((e) => `${name}: ${withPx(e.value, px)};${labelled ? ` /* ${e.theme} */` : ''}`).join('\n'), 'css');
        if (entries[0].chain.length) {
            md.appendMarkdown([name, ...entries[0].chain].map((n) => `\`${n}\``).join(' → '));
        }
        return new vscode.Hover(md, range);
    },
};

/** For a name that isn't in a token file: where else in the workspace it is declared, with its value. */
async function elsewhereHover(name: string, range: vscode.Range, uri: vscode.Uri) {
    const decls = (await getWorkspaceIndex()).declarations.get(name);
    if (!decls) {
        return undefined;
    }
    const px = rootFontSize(uri);
    const md = new vscode.MarkdownString();
    const values = [...new Set(decls.map((d) => d.value).filter(Boolean))];
    if (values.length) {
        md.appendCodeblock(values.map((v) => `${name}: ${withPx(v, px)};`).join('\n'), 'css');
    }
    md.appendMarkdown(`Declared in ${decls.map((d) => `${vscode.workspace.asRelativePath(d.uri)}:${d.line + 1}`).join(', ')}`);
    return new vscode.Hover(md, range);
}
