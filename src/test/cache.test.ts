import * as assert from 'assert';
import * as vscode from 'vscode';
import { orderedNames } from '../completion';
import { buildThemeMaps } from '../themes';
import { forgetFile, getTokens, invalidateTokens, readTokenFile, stats } from '../tokens';

suite('parse cache', () => {
    const dir = vscode.Uri.joinPath(vscode.workspace.workspaceFolders![0].uri, 'styles');
    const fileA = vscode.Uri.joinPath(dir, 'cache-a.css');
    const fileB = vscode.Uri.joinPath(dir, 'cache-b.css');
    const write = (uri: vscode.Uri, css: string) => vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(css));
    const names = async (uri: vscode.Uri) => (await readTokenFile(uri)).map((t) => t.name);
    const config = () => vscode.workspace.getConfiguration('cssTokens');

    teardown(async () => {
        await config().update('files', undefined, vscode.ConfigurationTarget.Workspace);
        for (const f of [fileA, fileB]) {
            await vscode.workspace.fs.delete(f, { useTrash: false }).then(undefined, () => undefined);
        }
        invalidateTokens();
    });

    test('an unchanged file is parsed once', async () => {
        await write(fileA, ':root { --one: 1 }');
        const before = stats.parses;
        await readTokenFile(fileA);
        await readTokenFile(fileA);
        assert.strictEqual(stats.parses - before, 1);
    });

    test('a changed file is parsed again, and forgetFile forces it', async () => {
        await write(fileA, ':root { --one: 1 }');
        assert.deepStrictEqual(await names(fileA), ['--one']);
        const before = stats.parses;

        await write(fileA, ':root { --one: 1; --two: 2 }'); // different size: the stamp changes
        assert.deepStrictEqual(await names(fileA), ['--one', '--two']);
        assert.strictEqual(stats.parses - before, 1);

        forgetFile(fileA);
        await readTokenFile(fileA);
        assert.strictEqual(stats.parses - before, 2);
    });

    test('rebuilding the token set only re-parses files that changed', async () => {
        await write(fileA, ':root { --a: 1 }');
        await write(fileB, ':root { --b: 1 }');
        await config().update('files', ['styles/cache-a.css', 'styles/cache-b.css'], vscode.ConfigurationTarget.Workspace);
        invalidateTokens();
        const before = stats.parses;

        await getTokens();
        assert.strictEqual(stats.parses - before, 2);

        invalidateTokens();
        assert.deepStrictEqual([...(await getTokens()).keys()].sort(), ['--a', '--b']);
        assert.strictEqual(stats.parses - before, 2); // both served from the cache

        await write(fileB, ':root { --b: 1; --b2: 2 }');
        invalidateTokens();
        assert.deepStrictEqual([...(await getTokens()).keys()].sort(), ['--a', '--b', '--b2']);
        assert.strictEqual(stats.parses - before, 3); // only b
    });
});

suite('orderedNames', () => {
    test('is computed once per token set', () => {
        const token = (name: string) => ({ name, value: '1', line: 0, column: 0, context: ':root' });
        const maps = buildThemeMaps(new Map([['--space-10', [token('--space-10')]], ['--space-2', [token('--space-2')]]]));
        const first = orderedNames(maps);
        assert.deepStrictEqual(first, ['--space-2', '--space-10']);
        assert.strictEqual(orderedNames(maps), first);
    });
});
