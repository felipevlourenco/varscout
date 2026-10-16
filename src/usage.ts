import * as vscode from 'vscode';
import { inCss } from './languages';

/** The token name at `position` if it is the first argument of a `var(`, e.g. the `--x` in `var(--x)`. */
export function varNameAt(
    document: vscode.TextDocument,
    position: vscode.Position,
): { name: string; range: vscode.Range } | undefined {
    const range = document.getWordRangeAtPosition(position, /--[\w-]+/);
    if (!range || !inCss(document, position)) {
        return undefined;
    }
    const before = document.lineAt(range.start).text.slice(0, range.start.character);
    return /var\(\s*$/.test(before) ? { name: document.getText(range), range } : undefined;
}
