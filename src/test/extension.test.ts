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
});
