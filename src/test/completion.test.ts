import * as assert from 'assert';
import * as vscode from 'vscode';
import { completionContext } from '../completion';

suite('completionContext', () => {
    test('offers inside var( and on -- words in value position', () => {
        assert.deepStrictEqual(completionContext('a { color: var('), { start: 15 });
        assert.deepStrictEqual(completionContext('a { color: var( --pri'), { start: 16 });
        assert.deepStrictEqual(completionContext('  color: --pri'), { start: 9 });
        assert.deepStrictEqual(completionContext('a { margin: 0 var(--a'), { start: 18 });
    });

    test('stays quiet elsewhere', () => {
        assert.strictEqual(completionContext('a { col'), undefined);
        assert.strictEqual(completionContext('a { color: red'), undefined);
        assert.strictEqual(completionContext('  --new-prop'), undefined); // declaring a property
        assert.strictEqual(completionContext('a { --new-prop'), undefined);
        assert.strictEqual(completionContext('a { color: foo--bar'), undefined);
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
        assert.strictEqual(items.get('--primary')?.detail, 'var(--blue-500)');
        assert.strictEqual(items.get('--shadow')?.detail, '0 1px 2px rgb(0 0 0 / 10%), 0 4px 8px rgb(0 0 0 / 20%)');
        assert.ok(!items.has('--commented-out'));
    });

    test('also triggers on a -- word', async () => {
        assert.ok((await complete('a { color: --pri')).has('--primary'));
    });

    test('no tokens when not in a variable context', async () => {
        assert.ok(!(await complete('a { col')).has('--primary'));
    });
});
