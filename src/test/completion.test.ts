import * as assert from 'assert';
import * as vscode from 'vscode';
import { completionContext, isColor } from '../completion';
import { inStyleBlock } from '../languages';

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

suite('inStyleBlock', () => {
    test('true only between <style> and </style>', () => {
        assert.ok(inStyleBlock('<template></template>\n<style>\n.a { color: '));
        assert.ok(inStyleBlock('<style lang="scss" scoped>\n.a {'));
        assert.ok(inStyleBlock('<style>a{}</style>\n<style is:global>\n.a {'));
        assert.ok(!inStyleBlock('<div style="color: '));
        assert.ok(!inStyleBlock('<style>a{}</style>\n<div>'));
        assert.ok(!inStyleBlock('<script>\nconst x = '));
        assert.ok(!inStyleBlock('<style lang="scss"'));
    });
});

suite('token completion provider', () => {
    suiteSetup(() => vscode.extensions.all.find((e) => e.packageJSON.name === 'varscout')!.activate());

    const complete = async (content: string, language = 'css') => {
        const doc = await vscode.workspace.openTextDocument({ language, content });
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
        // The color comes first so VS Code draws the swatch; theme values follow.
        assert.ok(String(items.get('--blue-500')?.documentation).startsWith('#3b82f6\n\ndefault: #3b82f6'));
        assert.strictEqual(items.get('--space-4')?.kind, vscode.CompletionItemKind.Variable);
        assert.strictEqual(items.get('--space-4')?.documentation, undefined);
        assert.strictEqual(items.get('--shadow')?.kind, vscode.CompletionItemKind.Variable);
    });

    test('references show the resolved value and the chain', async () => {
        const items = await complete('a { color: var(');
        const brand = items.get('--brand');
        assert.strictEqual(brand?.detail, '#3b82f6');
        assert.strictEqual(brand?.kind, vscode.CompletionItemKind.Color);
        assert.ok(String(brand?.documentation).startsWith('#3b82f6\n\n--brand → --primary → --blue-500'));
        assert.strictEqual(items.get('--ring')?.detail, '0 0 0 2px #3b82f6');
        assert.ok(String(items.get('--ring')?.documentation).startsWith('--ring → --primary → --blue-500'));
    });

    test('tokens redefined under a theme list a value per theme in the documentation', async () => {
        const items = await complete('a { color: var(');
        assert.strictEqual(
            items.get('--brand')?.documentation,
            '#3b82f6\n\n--brand → --primary → --blue-500\n\ndefault: #3b82f6\n@media (prefers-color-scheme: dark) :root: #60a5fa',
        );
        assert.strictEqual(
            items.get('--surface')?.documentation,
            'hsla(210, 40%, 96%, 0.9)\n\ndefault: hsla(210, 40%, 96%, 0.9)\n.dark: hsla(222, 47%, 11%, 0.9)',
        );
        assert.strictEqual(items.get('--space-4')?.documentation, undefined); // single value: no theme list
    });

    suite('live updates', () => {
        const file = vscode.Uri.joinPath(vscode.workspace.workspaceFolders![0].uri, 'styles', 'live.css');
        const write = (css: string) => vscode.workspace.fs.writeFile(file, new TextEncoder().encode(css));
        const config = () => vscode.workspace.getConfiguration('cssTokens');

        // File watchers are asynchronous, so poll instead of asserting right after the write.
        const eventually = async (name: string, expected: boolean) => {
            for (let i = 0; i < 50; i++) {
                if ((await complete('a { color: var(')).has(name) === expected) {
                    return;
                }
                await new Promise((r) => setTimeout(r, 100));
            }
            assert.fail(`${name} should ${expected ? '' : 'not '}be offered`);
        };

        suiteTeardown(async () => {
            await config().update('files', undefined, vscode.ConfigurationTarget.Workspace);
            await vscode.workspace.fs.delete(file, { useTrash: false }).then(undefined, () => undefined);
        });

        test('edits to a token file are picked up without reloading', async function () {
            this.timeout(15000); // three watcher round-trips, each polled for up to 5s
            await write(':root { --live-one: 1 }');
            await config().update('files', ['styles/live.css'], vscode.ConfigurationTarget.Workspace);
            await eventually('--live-one', true);

            await write(':root { --live-two: 2 }');
            await eventually('--live-two', true);
            await eventually('--live-one', false);

            await vscode.workspace.fs.delete(file, { useTrash: false });
            await eventually('--live-two', false);
        });
    });

    test('works in SCSS and Less', async () => {
        for (const language of ['scss', 'less']) {
            const items = await complete('.a { .b { color: var(', language);
            assert.strictEqual(items.get('--primary')?.detail, '#3b82f6', language);
        }
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
