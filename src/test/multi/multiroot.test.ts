import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import { getTokenFiles } from '../../tokenFiles';

// Folder a uses the default `**/tokens.css`; folder b's own settings point to `design/tokens.css`.
suite('multi-root workspaces', () => {
    suiteSetup(() => vscode.extensions.all.find((e) => e.packageJSON.name === 'varscout')!.activate());

    const [a, b] = vscode.workspace.workspaceFolders ?? [];
    const open = (folder: vscode.WorkspaceFolder, file: string) =>
        vscode.workspace.openTextDocument(vscode.Uri.joinPath(folder.uri, file));
    const labelOf = (i: vscode.CompletionItem) => (typeof i.label === 'string' ? i.label : i.label.label);

    const complete = async (doc: vscode.TextDocument) => {
        const list = await vscode.commands.executeCommand<vscode.CompletionList>(
            'vscode.executeCompletionItemProvider',
            doc.uri,
            doc.positionAt(doc.getText().length),
        );
        return new Map(list.items.map((i) => [labelOf(i), i]));
    };

    test('the workspace has both folders', () => {
        assert.deepStrictEqual(vscode.workspace.workspaceFolders?.map((f) => f.name), ['a', 'b']);
    });

    test('each folder resolves its own token files', async () => {
        const rel = async (folder: vscode.WorkspaceFolder) =>
            (await getTokenFiles(folder)).map((u) => path.relative(folder.uri.fsPath, u.fsPath));
        assert.deepStrictEqual(await rel(a), ['tokens.css']);
        assert.deepStrictEqual(await rel(b), [path.join('design', 'tokens.css')]); // b's setting wins over its decoy tokens.css
    });

    test('completion offers the tokens of the document\'s own folder', async () => {
        const inA = await complete(await open(a, 'page.css'));
        assert.ok(inA.has('--a-color') && !inA.has('--b-color') && !inA.has('--b-decoy'));
        assert.strictEqual(inA.get('--shared')?.detail, '1px');

        const inB = await complete(await open(b, 'page.css'));
        assert.ok(inB.has('--b-color') && !inB.has('--a-color') && !inB.has('--b-decoy'));
        assert.strictEqual(inB.get('--shared')?.detail, '2px');
    });

    test('untitled documents use the first folder', async () => {
        const doc = await vscode.workspace.openTextDocument({ language: 'css', content: 'a { color: var(' });
        assert.ok((await complete(doc)).has('--a-color'));
    });

    test('hover and go to definition use the document\'s folder', async () => {
        const doc = await open(b, 'uses-b.css');
        const at = doc.positionAt(doc.getText().indexOf('--b-color') + 3);
        const hovers = await vscode.commands.executeCommand<vscode.Hover[]>('vscode.executeHoverProvider', doc.uri, at);
        const text = hovers.flatMap((h) => h.contents.map((c) => (typeof c === 'string' ? c : (c as vscode.MarkdownString).value))).join('\n');
        assert.ok(text.includes('--b-color: #0000ff;'), text);

        const defs = await vscode.commands.executeCommand<(vscode.Location | vscode.LocationLink)[]>(
            'vscode.executeDefinitionProvider',
            doc.uri,
            at,
        );
        const targets = defs.map((d) => ('targetUri' in d ? d.targetUri : d.uri).fsPath);
        assert.ok(targets.includes(vscode.Uri.joinPath(b.uri, 'design', 'tokens.css').fsPath), targets.join(', '));

        // The same usage in folder a: `--b-color` isn't a token there, so no hover from us.
        const docA = await open(a, 'uses-b.css');
        const hoversA = await vscode.commands.executeCommand<vscode.Hover[]>(
            'vscode.executeHoverProvider',
            docA.uri,
            docA.positionAt(docA.getText().indexOf('--b-color') + 3),
        );
        assert.ok(!JSON.stringify(hoversA).includes('--b-color: #0000ff'));
    });

    test('diagnostics are checked against the document\'s own folder', async () => {
        const flagged = async (folder: vscode.WorkspaceFolder) => {
            const doc = await open(folder, 'uses-b.css');
            for (let i = 0; i < 50; i++) {
                const diags = vscode.languages.getDiagnostics(doc.uri).filter((d) => d.source === 'VarScout');
                if (diags.some((d) => doc.getText(d.range) === '--sentinel')) {
                    return diags.map((d) => doc.getText(d.range)).sort();
                }
                await new Promise((r) => setTimeout(r, 100));
            }
            return assert.fail('no diagnostics');
        };
        assert.deepStrictEqual(await flagged(a), ['--b-color', '--sentinel']); // a has no --b-color
        assert.deepStrictEqual(await flagged(b), ['--sentinel']);
    });
});
