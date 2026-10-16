import * as vscode from 'vscode';
import { isColor } from './completion';
import { inDeclarations } from './languages';
import { themeValues } from './themes';
import { getThemes, getTokens } from './tokens';

/** Case, spacing and `#rgb` vs `#rrggbb` differences don't matter when comparing values. */
export function normalizeValue(value: string): string {
    return value
        .trim()
        .toLowerCase()
        .replace(/\s*([,()/])\s*/g, '$1')
        .replace(/\s+/g, ' ')
        .replace(/^#([\da-f])([\da-f])([\da-f])$/, '#$1$1$2$2$3$3');
}

const isDimension = (v: string) => /^[+-]?(\d+\.?\d*|\.\d+)[a-z%]+$/i.test(v);

/**
 * Candidate literals in the property declarations of one line: colors, dimensions (`1rem`) and multi-part
 * values (whole value or a function call), anywhere outside `var()` and custom property declarations.
 * Bare numbers and keywords (`0`, `auto`) are left out because nearly every token set would match them.
 */
export function hardcodedValues(line: string): { start: number; end: number; text: string }[] {
    const found: { start: number; end: number; text: string }[] = [];
    for (const m of line.matchAll(/([\w-]+)\s*:\s*([^;{}]+)/g)) {
        if (m[1].startsWith('--')) {
            continue;
        }
        const base = m.index + m[0].length - m[2].length;
        const value = m[2].replace(/\s*(!important)?\s*$/i, '');
        const parts: { start: number; end: number }[] = [];
        let depth = 0;
        let from = -1;
        for (let i = 0; i <= value.length; i++) {
            const c = value[i];
            const split = i === value.length || (depth === 0 && /[\s,]/.test(c));
            if (split && from >= 0) {
                parts.push({ start: from, end: i });
                from = -1;
            } else if (!split && from < 0) {
                from = i;
            }
            depth += c === '(' ? 1 : c === ')' ? -1 : 0;
        }
        if (parts.length > 1) {
            parts.push({ start: 0, end: value.length });
        }
        for (const p of parts) {
            const text = value.slice(p.start, p.end);
            if (!text.includes('var(') && (isColor(text) || isDimension(text) || /[\s,(]/.test(text))) {
                found.push({ start: base + p.start, end: base + p.end, text });
            }
        }
    }
    return found;
}

const MAX_LINES = 500;
const MAX_PER_VALUE = 5;

/** Offers to replace a hardcoded value under the cursor / selection with a token that resolves to the same value. */
export const hardcodedValueFixes: vscode.CodeActionProvider = {
    async provideCodeActions(document, range) {
        if (!inDeclarations(document, range.start)) {
            return undefined;
        }
        const themes = await getThemes(document.uri);
        const byValue = new Map<string, string[]>();
        for (const name of themes.get('default')!.keys()) {
            const key = normalizeValue(themeValues(name, themes)[0].value);
            byValue.set(key, [...(byValue.get(key) ?? []), name]);
        }
        const tokens = await getTokens(document.uri);

        const actions: vscode.CodeAction[] = [];
        const last = Math.min(range.end.line, range.start.line + MAX_LINES);
        for (let line = range.start.line; line <= last; line++) {
            for (const v of hardcodedValues(document.lineAt(line).text)) {
                const at = new vscode.Range(line, v.start, line, v.end);
                const key = normalizeValue(v.text);
                if (!at.intersection(range)) {
                    continue;
                }
                // Tokens declared with exactly this value come first: `--blue-500`, then `--primary` (= var(--blue-500)).
                const names = [...(byValue.get(key) ?? [])].sort(
                    (a, b) => Number(normalizeValue(tokens.get(b)!.value) === key) - Number(normalizeValue(tokens.get(a)!.value) === key),
                );
                names.slice(0, MAX_PER_VALUE).forEach((name, i) => {
                    const action = new vscode.CodeAction(`Replace ${v.text} with var(${name})`, vscode.CodeActionKind.QuickFix);
                    action.edit = new vscode.WorkspaceEdit();
                    action.edit.replace(document.uri, at, `var(${name})`);
                    action.isPreferred = i === 0 && normalizeValue(tokens.get(name)!.value) === key;
                    actions.push(action);
                });
            }
        }
        return actions;
    },
};
