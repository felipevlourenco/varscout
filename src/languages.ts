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

/** Whether `position` is somewhere CSS can appear (always, except outside `<style>` in Vue/Svelte/Astro). */
export function inCss(document: vscode.TextDocument, position: vscode.Position): boolean {
    return (
        !EMBEDDED.includes(document.languageId) ||
        inStyleBlock(document.getText(new vscode.Range(0, 0, position.line, position.character)))
    );
}
