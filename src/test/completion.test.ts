import * as assert from 'assert';
import * as vscode from 'vscode';
import { completionContext, isColor } from '../completion';

suite('completionContext', () => {
    test('offers inside var( and on -- words in value position', () => {
        assert.deepStrictEqual(completionContext('a { color: var('), { start: 15, inVar: true });
        assert.deepStrictEqual(completionContext('a { color: var( --pri'), { start: 16, inVar: true });
        assert.deepStrictEqual(completionContext('  color: --pri'), { start: 9, inVar: false });
        assert.deepStrictEqual(completionContext('a { margin: 0 var(--a'), { start: 18, inVar: true });
    });

    test('stays quiet elsewhere', () => {
        assert.strictEqual(completionContext('a { col'), undefined);
        assert.strictEqual(completionContext('a { color: red'), undefined);
        assert.strictEqual(completionContext('  --new-prop'), undefined); // declaring a property
        assert.strictEqual(completionContext('a { --new-prop'), undefined);
        assert.strictEqual(completionContext('a { color: foo--bar'), undefined);
    });
});

suite('isColor', () => {
    test('recognises color values only', () => {
        for (const v of ['#fff', '#3b82f6', '#3b82f680', 'rgb(0 0 0 / 10%)', 'rgba(0, 0, 0, .5)', 'hsl(210 50% 40%)', 'oklch(70% 0.1 200)']) {
            assert.ok(isColor(v), v);
        }
        for (const v of ['1rem', 'var(--blue-500)', '0 1px 2px rgb(0 0 0 / 10%)', '#zzz', '16px']) {
            assert.ok(!isColor(v), v);
        }
    });
});

suite('token completion provider', () => {
    suiteSetup(() => vscode.extensions.all.find((e) => e.packageJSON.name === 'varscout')!.activate());

    const complete = async (content: string) => {
        const doc = await vscode.workspace.openTextDocument({ language: 'css', content });
        const list = await vscode.commands.executeCommand<vscode.CompletionList>(
            'vscode.executeCompletionItemProvider',
            doc.uri,
            doc.positionAt(content.length),
        );
        return new Map(list.items.map((i) => [typeof i.label === 'string' ? i.label : i.label.label, i]));
    };

    test('label is the name and detail is the value, inside var(', async () => {
        const items = await complete('a { color: var(');
        assert.strictEqual(items.get('--blue-500')?.detail, '#3b82f6'); // first definition wins over the dark @media one
        assert.strictEqual(items.get('--primary')?.detail, '#3b82f6'); // resolved through var(--blue-500)
        assert.strictEqual(items.get('--shadow')?.detail, '0 1px 2px rgb(0 0 0 / 10%), 0 4px 8px rgb(0 0 0 / 20%)');
        assert.ok(!items.has('--commented-out'));
    });

    test('colors get the Color kind with the value as documentation; others stay Variable', async () => {
        const items = await complete('a { color: var(');
        assert.strictEqual(items.get('--blue-500')?.kind, vscode.CompletionItemKind.Color);
        assert.strictEqual(items.get('--blue-500')?.documentation, '#3b82f6');
        assert.strictEqual(items.get('--space-4')?.kind, vscode.CompletionItemKind.Variable);
        assert.strictEqual(items.get('--space-4')?.documentation, undefined);
        assert.strictEqual(items.get('--shadow')?.kind, vscode.CompletionItemKind.Variable);
    });

    test('references show the resolved value and the chain', async () => {
        const items = await complete('a { color: var(');
        const brand = items.get('--brand');
        assert.strictEqual(brand?.detail, '#3b82f6');
        assert.strictEqual(brand?.kind, vscode.CompletionItemKind.Color);
        assert.strictEqual(brand?.documentation, '#3b82f6\n\n--brand → --primary → --blue-500');
        assert.strictEqual(items.get('--ring')?.detail, '0 0 0 2px #3b82f6');
        assert.strictEqual(items.get('--ring')?.documentation, '--ring → --primary → --blue-500');
    });

    test('also triggers on a -- word', async () => {
        assert.ok((await complete('a { color: --pri')).has('--primary'));
    });

    test('inserts var(--x) as a value but only --x inside var(', async () => {
        assert.strictEqual((await complete('a { color: --pri')).get('--primary')?.insertText, 'var(--primary)');
        assert.strictEqual((await complete('a { color: var(')).get('--primary')?.insertText, '--primary');
        assert.strictEqual((await complete('a { color: var(--pri')).get('--primary')?.insertText, '--primary');
    });

    test('no tokens when not in a variable context', async () => {
        assert.ok(!(await complete('a { col')).has('--primary'));
    });
});
