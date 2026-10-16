import * as vscode from 'vscode';

/** The px size of 1rem: `cssTokens.rootFontSize` (default 16). */
export const rootFontSize = () => vscode.workspace.getConfiguration('cssTokens').get<number>('rootFontSize', 16);

/**
 * Adds the px equivalent after each top-level `rem` length: `1.5rem` -> `1.5rem (24px)`.
 * Lengths inside functions (`calc()`, `clamp()`, `var()` fallbacks) are left alone.
 */
export function withPx(value: string, rootPx = 16): string {
    return value.replace(/(?<![\w.-])([+-]?(?:\d+\.?\d*|\.\d+))rem\b/gi, (match, n: string, offset: number) => {
        const before = value.slice(0, offset);
        if (before.split('(').length !== before.split(')').length) {
            return match; // inside parentheses
        }
        return `${match} (${Math.round(parseFloat(n) * rootPx * 100) / 100}px)`;
    });
}
