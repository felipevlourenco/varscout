import * as vscode from 'vscode';

export const SELECTOR = ['css', 'scss', 'less', 'vue', 'svelte', 'astro'].map((language) => ({ language }));

/** Languages where CSS only lives in `<style>` blocks. */
const EMBEDDED = ['vue', 'svelte', 'astro'];

/** Whether the end of `text` is inside an open `<style ...>` block. */
export function inStyleBlock(text: string): boolean {
    let inside = false;
    for (const m of text.matchAll(/<style\b[^>]*>|<\/style\s*>/gi)) {
        inside = !m[0].startsWith('</');
    }
    return inside;
}

/** Offset ranges of `text` that hold CSS: all of it, or only the `<style>` blocks for Vue/Svelte/Astro. */
export function cssRegions(text: string, languageId: string): { start: number; end: number }[] {
    if (!EMBEDDED.includes(languageId)) {
        return [{ start: 0, end: text.length }];
    }
    return [...text.matchAll(/(<style\b[^>]*>)([\s\S]*?)(?:<\/style\s*>|$)/gi)].map((m) => {
        const start = m.index + m[1].length;
        return { start, end: start + m[2].length };
    });
}

/** Whether `position` is somewhere CSS can appear (always, except outside `<style>` in Vue/Svelte/Astro). */
export function inCss(document: vscode.TextDocument, position: vscode.Position): boolean {
    return (
        !EMBEDDED.includes(document.languageId) ||
        inStyleBlock(document.getText(new vscode.Range(0, 0, position.line, position.character)))
    );
}
