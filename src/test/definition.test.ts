import * as assert from 'assert';
import * as vscode from 'vscode';

suite('token definition', () => {
    suiteSetup(() => vscode.extensions.all.find((e) => e.packageJSON.name === 'varscout')!.activate());

    const tokensCss = vscode.Uri.joinPath(vscode.workspace.workspaceFolders![0].uri, 'tokens.css');

    /** Links into the token file for the `target` usage in `content` (VS Code's own CSS service may add same-document ones). */
    const definitions = async (content: string, target: string) => {
        const doc = await vscode.workspace.openTextDocument({ language: 'css', content });
        const result = await vscode.commands.executeCommand<(vscode.Location | vscode.LocationLink)[]>(
            'vscode.executeDefinitionProvider',
            doc.uri,
            doc.positionAt(content.indexOf(target) + 4),
        );
        return result
            .map((r) => {
                const { uri, range } = 'targetUri' in r ? { uri: r.targetUri, range: r.targetSelectionRange! } : r;
                return { uri: uri.toString(), line: range.start.line, character: range.start.character, end: range.end.character };
            })
            .filter((l) => l.uri === tokensCss.toString());
    };

    /** 0-based [line, character] of every `name:` declaration in the fixture. */
    const declarations = async (name: string) => {
        const lines = new TextDecoder().decode(await vscode.workspace.fs.readFile(tokensCss)).split('\n');
        return lines.flatMap((l, line) => (l.trimStart().startsWith(`${name}:`) ? [[line, l.indexOf(name)]] : []));
    };

    test('jumps to the declaration in the token file', async () => {
        const [link, ...rest] = await definitions('a { color: var(--primary); }', '--primary');
        const [[line, character]] = await declarations('--primary');
        assert.deepStrictEqual(rest, []);
        assert.deepStrictEqual(link, { uri: tokensCss.toString(), line, character, end: character + '--primary'.length });
    });

    test('a redefined token has one location per declaration', async () => {
        const links = await definitions('a { color: var(--blue-500); }', '--blue-500');
        const expected = await declarations('--blue-500');
        assert.strictEqual(expected.length, 2);
        assert.deepStrictEqual(links.map((l) => [l.line, l.character]), expected);
    });

    test('nothing for unknown tokens or outside var()', async () => {
        assert.deepStrictEqual(await definitions('a { color: var(--nope); }', '--nope'), []);
        assert.deepStrictEqual(await definitions('a { --primary: red; }', '--primary'), []);
    });
});
