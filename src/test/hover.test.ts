import * as assert from 'assert';
import * as vscode from 'vscode';

suite('token hover', () => {
    suiteSetup(() => vscode.extensions.all.find((e) => e.packageJSON.name === 'varscout')!.activate());

    /** Hover text at the middle of `target` in `content` (other providers' hovers are included, so callers match on substrings). */
    const hover = async (content: string, target: string, language = 'css') => {
        const doc = await vscode.workspace.openTextDocument({ language, content });
        const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
            'vscode.executeHoverProvider',
            doc.uri,
            doc.positionAt(content.indexOf(target) + 4),
        );
        return hovers.flatMap((h) => h.contents.map((c) => (typeof c === 'string' ? c : (c as vscode.MarkdownString).value))).join('\n');
    };

    test('shows the resolved value and the chain for a var() usage', async () => {
        const text = await hover('a { color: var(--primary); }', '--primary');
        assert.ok(text.includes('--primary: #3b82f6;'), text);
        assert.ok(text.includes('`--primary` → `--blue-500`'), text);
    });

    test('a name declared outside the token files shows its value and where it is declared', async () => {
        const text = await hover('a { margin: var(--dynamic-offset); }', '--dynamic-offset');
        assert.ok(text.includes('--dynamic-offset: ${offset}px;'), text);
        assert.ok(text.includes('styles/dynamic.tsx:3'), text);
    });

    test('lists every definition of a redefined token', async () => {
        const text = await hover('a { color: var(--blue-500); }', '--blue-500');
        assert.ok(
            text.includes(
                '--blue-500: #3b82f6; /* default */\n--blue-500: #60a5fa; /* @media (prefers-color-scheme: dark) :root */',
            ),
            text,
        );
    });

    test('shows per-theme values for attribute selectors and for tokens that only inherit the change', async () => {
        const text = await hover('a { color: var(--text); background: var(--primary); }', '--text');
        // Quote style depends on the formatter that last saved the fixture.
        assert.match(text, /--text: rgb\(229, 231, 235\); \/\* :root\[data-theme=["']dark["']\] \*\//);
        const inherited = await hover('a { background: var(--primary); }', '--primary');
        assert.ok(inherited.includes('--primary: #60a5fa; /* @media (prefers-color-scheme: dark) :root */'), inherited);
    });

    test('nothing for unknown tokens or outside var()', async () => {
        assert.ok(!(await hover('a { color: var(--nope); }', '--nope')).includes('--nope:'));
        assert.ok(!(await hover('a { --primary: red; }', '--primary')).includes('#3b82f6'));
    });

    test('works for var() in TS/TSX strings and styled templates', async () => {
        assert.ok(
            (await hover("const s = { color: 'var(--primary)' };", '--primary', 'typescript')).includes('--primary: #3b82f6;'),
        );
        assert.ok(
            (await hover('const A = styled.div`\n  color: var(--primary);\n`;', '--primary', 'typescriptreact')).includes(
                '--primary: #3b82f6;',
            ),
        );
    });
});
