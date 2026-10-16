import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import { getTokenFiles } from '../tokenFiles';

const names = async () =>
    (await getTokenFiles()).map((u) => path.relative(vscode.workspace.workspaceFolders![0].uri.fsPath, u.fsPath)).sort();

suite('getTokenFiles', () => {
    const config = () => vscode.workspace.getConfiguration('cssTokens');
    teardown(() => config().update('files', undefined, vscode.ConfigurationTarget.Workspace));

    test('default glob finds tokens.css and skips node_modules', async () => {
        assert.deepStrictEqual(await names(), ['tokens.css']);
    });

    test('multiple globs are merged and de-duplicated', async () => {
        await config().update('files', ['**/tokens.css', 'styles/extra.*', 'tokens.css'], vscode.ConfigurationTarget.Workspace);
        assert.deepStrictEqual(await names(), [path.join('styles', 'extra.css'), 'tokens.css']);
    });

    test('absolute paths are used as-is', async () => {
        const abs = path.join(vscode.workspace.workspaceFolders![0].uri.fsPath, 'styles', 'extra.css');
        await config().update('files', [abs], vscode.ConfigurationTarget.Workspace);
        assert.deepStrictEqual(await names(), [path.join('styles', 'extra.css')]);
    });

    test('node_modules is searched only when the entry names it', async () => {
        await config().update('files', ['node_modules/pkg/tokens.css'], vscode.ConfigurationTarget.Workspace);
        assert.deepStrictEqual(await names(), [path.join('node_modules', 'pkg', 'tokens.css')]);

        await config().update('files', ['node_modules/**/*.css'], vscode.ConfigurationTarget.Workspace);
        assert.deepStrictEqual(await names(), [
            path.join('node_modules', '@acme', 'design', 'css', 'dark.css'),
            path.join('node_modules', '@acme', 'design', 'css', 'tokens.css'),
            path.join('node_modules', 'pkg', 'tokens.css'),
        ]);
    });

    test('package files resolve through node_modules, including globs', async () => {
        await config().update('files', ['@acme/design/css/tokens.css'], vscode.ConfigurationTarget.Workspace);
        assert.deepStrictEqual(await names(), [path.join('node_modules', '@acme', 'design', 'css', 'tokens.css')]);

        await config().update('files', ['@acme/design/css/*.css'], vscode.ConfigurationTarget.Workspace);
        assert.deepStrictEqual(await names(), [
            path.join('node_modules', '@acme', 'design', 'css', 'dark.css'),
            path.join('node_modules', '@acme', 'design', 'css', 'tokens.css'),
        ]);
    });

    test('a package is also found in a parent folder\'s node_modules', async () => {
        await config().update('files', ['hoisted/tokens.css', 'nope/tokens.css'], vscode.ConfigurationTarget.Workspace);
        assert.deepStrictEqual(await names(), [path.join('..', 'node_modules', 'hoisted', 'tokens.css')]);
    });
});
