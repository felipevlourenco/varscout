import * as assert from 'assert';
import * as vscode from 'vscode';
import { hardcodedValues, normalizeValue } from '../quickfix';

suite('hardcodedValues', () => {
    const texts = (line: string) => hardcodedValues(line).map((v) => [v.text, line.slice(v.start, v.end)]);

    test('finds colors, dimensions and multi-part values with their offsets', () => {
        assert.deepStrictEqual(texts('  color: #3B82F6;'), [['#3B82F6', '#3B82F6']]);
        assert.deepStrictEqual(texts('a { padding: 1rem; margin: 0 }'), [['1rem', '1rem']]);
        assert.deepStrictEqual(texts('border: 1px solid #3b82f6 !important;'), [
            ['1px', '1px'],
            ['#3b82f6', '#3b82f6'],
            ['1px solid #3b82f6', '1px solid #3b82f6'],
        ]);
        assert.deepStrictEqual(texts('box-shadow: 0 1px rgb(0 0 0 / 10%), 0 2px red'), [
            ['1px', '1px'],
            ['rgb(0 0 0 / 10%)', 'rgb(0 0 0 / 10%)'],
            ['2px', '2px'],
            ['0 1px rgb(0 0 0 / 10%), 0 2px red', '0 1px rgb(0 0 0 / 10%), 0 2px red'],
        ]);
    });

    test('skips var(), custom property declarations, keywords and bare numbers', () => {
        assert.deepStrictEqual(texts('color: var(--primary);'), []);
        assert.deepStrictEqual(texts('--x: #3b82f6;'), []);
        assert.deepStrictEqual(texts('a { color: red; z-index: 1; width: auto }'), []);
        assert.deepStrictEqual(texts('a:hover {'), []);
        assert.deepStrictEqual(texts('border: 1px solid var(--c)'), [['1px', '1px']]);
    });
});

suite('normalizeValue', () => {
    test('ignores case, spacing and short hex', () => {
        assert.strictEqual(normalizeValue('#FFF'), normalizeValue('#ffffff'));
        assert.strictEqual(normalizeValue('rgb(17,24,39)'), normalizeValue('RGB( 17, 24, 39 )'));
        assert.notStrictEqual(normalizeValue('1rem'), normalizeValue('2rem'));
    });
});

suite('hardcoded value quick fix', () => {
    suiteSetup(() => vscode.extensions.all.find((e) => e.packageJSON.name === 'varscout')!.activate());

    /** Our quick fixes at the middle of `target` in `content`. */
    const fixes = async (content: string, target: string, language = 'css') => {
        const doc = await vscode.workspace.openTextDocument({ language, content });
        const at = doc.positionAt(content.indexOf(target) + 1);
        const run = () =>
            vscode.commands.executeCommand<vscode.CodeAction[]>(
                'vscode.executeCodeActionProvider',
                doc.uri,
                new vscode.Range(at, at),
                vscode.CodeActionKind.QuickFix.value,
            );
        // The built-in TypeScript server sometimes cancels the combined request while it starts up; retry.
        const actions = await run().then(undefined, () => new Promise((r) => setTimeout(r, 300)).then(run));
        return { doc, actions: actions.filter((a) => a.title.startsWith('Replace ') && a.title.includes(' with var(')) };
    };

    test('suggests tokens with that value, the ones declared with it first', async () => {
        const { doc, actions } = await fixes('a { color: #3B82F6; }', '#3B82F6');
        assert.deepStrictEqual(
            actions.map((a) => a.title),
            [
                'Replace #3B82F6 with var(--blue-500)',
                'Replace #3B82F6 with var(--primary)',
                'Replace #3B82F6 with var(--brand)',
            ],
        );
        assert.deepStrictEqual(actions.map((a) => a.isPreferred), [true, false, false]);

        await vscode.workspace.applyEdit(actions[0].edit!);
        assert.strictEqual(doc.getText(), 'a { color: var(--blue-500); }');
    });

    test('dimensions and whole multi-part values', async () => {
        assert.deepStrictEqual((await fixes('a { padding: 1rem; }', '1rem')).actions.map((a) => a.title), [
            'Replace 1rem with var(--space-4)',
        ]);
        const shadow = '0 1px 2px rgb(0 0 0 / 10%), 0 4px 8px rgb(0 0 0 / 20%)';
        assert.deepStrictEqual((await fixes(`a { box-shadow: ${shadow}; }`, '2px')).actions.map((a) => a.title), [
            `Replace ${shadow} with var(--shadow)`,
        ]);
    });

    test('nothing for values no token has, custom property declarations, or the cursor elsewhere', async () => {
        assert.deepStrictEqual((await fixes('a { color: #123456; }', '#123456')).actions, []);
        assert.deepStrictEqual((await fixes('a { --mine: #3b82f6; }', '#3b82f6')).actions, []);
        assert.deepStrictEqual((await fixes('a { color: #3b82f6; width: 5px; }', 'width')).actions, []);
    });

    test('in TS/TSX only inside styled templates', async () => {
        const { doc, actions } = await fixes('const A = styled.div`\n  color: #3b82f6;\n`;', '#3b82f6', 'typescriptreact');
        assert.strictEqual(actions[0].title, 'Replace #3b82f6 with var(--blue-500)');
        await vscode.workspace.applyEdit(actions[0].edit!);
        assert.strictEqual(doc.getText(), 'const A = styled.div`\n  color: var(--blue-500);\n`;');

        assert.deepStrictEqual((await fixes('const a = 1;\n// padding: 1rem;', '1rem', 'typescript')).actions, []);
    });
});
