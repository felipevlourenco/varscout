import * as vscode from 'vscode';

/** Languages where CSS lives inside strings and template literals (styled-components, inline styles...). */
export const SCRIPT = ['javascript', 'javascriptreact', 'typescript', 'typescriptreact'];

export const SELECTOR = ['css', 'scss', 'less', 'vue', 'svelte', 'astro', ...SCRIPT].map((language) => ({ language }));

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

// styled.div`, styled(Button)`, styled.a.attrs(...)`, styled.div<Props>`, css`, keyframes`, createGlobalStyle`...
const CSS_TAG_END =
    /(?:\bstyled\s*(?:\.\w+|\([^()`]*\))(?:\s*\.attrs\([^`]*\))?|\b(?:css|createGlobalStyle|keyframes|injectGlobal))\s*(?:<[^<>`]*>\s*)?`$/;

/** Index of the backtick closing a template literal whose content starts at `i` (or the end of `text`). */
function findClose(text: string, i: number): number {
    while (i < text.length) {
        const c = text[i];
        if (c === '\\') {
            i += 2;
        } else if (c === '`') {
            return i;
        } else if (c === '$' && text[i + 1] === '{') {
            i = skipExpression(text, i + 2);
        } else {
            i++;
        }
    }
    return text.length;
}

/** Index after the `}` closing a `${` whose expression starts at `i`; nested strings and templates are skipped. */
function skipExpression(text: string, i: number): number {
    let depth = 1;
    while (i < text.length && depth) {
        const c = text[i];
        if (c === '`') {
            i = findClose(text, i + 1) + 1;
        } else if (c === '"' || c === "'") {
            i++;
            while (i < text.length && text[i] !== c) {
                i += text[i] === '\\' ? 2 : 1;
            }
            i++;
        } else {
            depth += c === '{' ? 1 : c === '}' ? -1 : 0;
            i++;
        }
    }
    return i;
}

/**
 * Contents of CSS-in-JS tagged template literals in `text` (`${...}` interpolations included).
 * Walks the text so tags inside comments, strings and other templates (`\`not css\``) aren't mistaken for CSS.
 */
export function templateRegions(text: string): { start: number; end: number }[] {
    const regions: { start: number; end: number }[] = [];
    let i = 0;
    while (i < text.length) {
        const c = text[i];
        if (c === '/' && (text[i + 1] === '/' || text[i + 1] === '*')) {
            const end = text[i + 1] === '/' ? text.indexOf('\n', i) : text.indexOf('*/', i + 2);
            i = end < 0 ? text.length : end + 1;
        } else if (c === '"' || c === "'") {
            // JS strings end at the closing quote or the line end (so a JSX apostrophe can't swallow the file).
            for (i++; i < text.length && text[i] !== c && text[i] !== '\n'; i += text[i] === '\\' ? 2 : 1) {
                /* skip */
            }
            i++;
        } else if (c === '`') {
            const end = findClose(text, i + 1);
            if (CSS_TAG_END.test(text.slice(Math.max(0, i - 300), i + 1))) {
                regions.push({ start: i + 1, end });
            }
            i = end + 1;
        } else {
            i++;
        }
    }
    return regions;
}

/** The CSS-in-JS template literal containing `position`, if any. */
export function templateRegionAt(document: vscode.TextDocument, position: vscode.Position) {
    const offset = document.offsetAt(position);
    return templateRegions(document.getText()).find((r) => r.start <= offset && offset <= r.end);
}

/** Whether `position` is somewhere `var(--x)` can appear: anywhere in scripts and CSS, `<style>` blocks in Vue/Svelte/Astro. */
export function inCss(document: vscode.TextDocument, position: vscode.Position): boolean {
    return (
        !EMBEDDED.includes(document.languageId) ||
        inStyleBlock(document.getText(new vscode.Range(0, 0, position.line, position.character)))
    );
}

/** Whether CSS declarations (`color: red;`) can be written at `position`: like `inCss`, but in scripts only inside styled templates. */
export function inDeclarations(document: vscode.TextDocument, position: vscode.Position): boolean {
    return SCRIPT.includes(document.languageId) ? !!templateRegionAt(document, position) : inCss(document, position);
}
