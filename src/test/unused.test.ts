import * as assert from 'assert';
import * as vscode from 'vscode';
import { findUnused } from '../unused';
import { Definition } from '../tokens';
import { getWorkspaceIndex } from '../workspaceVars';

const def = (name: string, value: string): Definition => ({ name, value, line: 0, column: 0, context: '', uri: vscode.Uri.file('/t.css') });

suite('findUnused', () => {
    test('a token is used when a file or another token refers to it', () => {
        const tokens = new Map([
            ['--a', [def('--a', '1')]],
            ['--b', [def('--b', 'var(--a)')]],
            ['--c', [def('--c', '2')]],
            ['--d', [def('--d', '3')]],
        ]);
        assert.deepStrictEqual([...findUnused(tokens, new Set(['--c'])).keys()], ['--b', '--d']);
    });
});

suite('workspace index', () => {
    test('collects declarations and usages, skipping node_modules', async () => {
        const { declarations, used } = await getWorkspaceIndex();
        const [d] = declarations.get('--dynamic-offset')!;
        assert.ok(d.uri.path.endsWith('styles/dynamic.tsx'));
        assert.strictEqual(d.line, 1);
        assert.ok(used.has('--primary'));
        assert.ok(!declarations.has('--from-node-modules'));
    });
});
