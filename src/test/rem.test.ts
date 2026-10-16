import * as assert from 'assert';
import * as vscode from 'vscode';
import { withPx } from '../rem';

suite('withPx', () => {
    test('adds the px equivalent after each top-level rem length', () => {
        assert.strictEqual(withPx('1.5rem'), '1.5rem (24px)');
        assert.strictEqual(withPx('0 .5rem 1rem'), '0 .5rem (8px) 1rem (16px)');
        assert.strictEqual(withPx('-0.25rem'), '-0.25rem (-4px)');
        assert.strictEqual(withPx('0.3rem'), '0.3rem (4.8px)');
        assert.strictEqual(withPx('1rem', 10), '1rem (10px)');
        assert.strictEqual(withPx('1REM'), '1REM (16px)');
    });

    test('leaves other values and lengths inside functions alone', () => {
        for (const v of ['16px', '2em', '#3b82f6', 'clamp(1rem, 2vw, 3rem)', 'calc(1rem + 2px)', 'var(--a, 1rem)', 'rem', '--x-2rem']) {
            assert.strictEqual(withPx(v), v);
        }
    });
});

suite('px equivalents in completion and hover', () => {
    suiteSetup(() => vscode.extensions.all.find((e) => e.packageJSON.name === 'varscout')!.activate());
    const config = () => vscode.workspace.getConfiguration('cssTokens');
    teardown(() => config().update('rootFontSize', undefined, vscode.ConfigurationTarget.Workspace));

    const completion = async () => {
        const doc = await vscode.workspace.openTextDocument({ language: 'css', content: 'a { margin: var(' });
        const list = await vscode.commands.executeCommand<vscode.CompletionList>(
            'vscode.executeCompletionItemProvider',
            doc.uri,
            doc.positionAt(16),
        );
        return new Map(list.items.map((i) => [typeof i.label === 'string' ? i.label : i.label.label, i]));
    };

    const hover = async () => {
        const content = 'a { margin: var(--space-4); }';
        const doc = await vscode.workspace.openTextDocument({ language: 'css', content });
        const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
            'vscode.executeHoverProvider',
            doc.uri,
            doc.positionAt(content.indexOf('--space-4') + 3),
        );
        return hovers.flatMap((h) => h.contents.map((c) => (typeof c === 'string' ? c : (c as vscode.MarkdownString).value))).join('\n');
    };

    test('completion shows rem values with px', async () => {
        const items = await completion();
        assert.strictEqual(items.get('--space-4')?.detail, '1rem (16px)');
        assert.strictEqual(items.get('--space-2')?.detail, '0.5rem (8px)');
        assert.strictEqual(items.get('--space-10')?.insertText, '--space-10'); // inserted text is unchanged
    });

    test('hover shows rem values with px', async () => {
        assert.ok((await hover()).includes('--space-4: 1rem (16px);'));
    });

    test('cssTokens.rootFontSize changes the conversion', async () => {
        await config().update('rootFontSize', 10, vscode.ConfigurationTarget.Workspace);
        assert.strictEqual((await completion()).get('--space-4')?.detail, '1rem (10px)');
        assert.ok((await hover()).includes('--space-4: 1rem (10px);'));
    });
});
