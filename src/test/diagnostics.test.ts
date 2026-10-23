import * as assert from 'assert';
import * as vscode from 'vscode';
import { scanVars } from '../diagnostics';
import { cssRegions } from '../languages';

suite('scanVars', () => {
    test('finds usages and declarations, ignoring comments', () => {
        const css = `a { --local: 1px; width: var(--local); height: var( --h , 1px); /* var(--ghost) */ }`;
        const { usages, declared } = scanVars(css);
        assert.deepStrictEqual(usages.map((u) => [u.name, css.slice(u.index, u.index + u.name.length)]), [
            ['--local', '--local'],
            ['--h', '--h'],
        ]);
        assert.deepStrictEqual([...declared], ['--local']);
    });

    test('line comments only count for scss/less', () => {
        const css = `// var(--ghost)\na { color: var(--real); background: url(http://x/y.png) }`;
        assert.deepStrictEqual(scanVars(css, true).usages.map((u) => u.name), ['--real']);
        assert.deepStrictEqual(scanVars(css).usages.map((u) => u.name), ['--ghost', '--real']);
    });
});

suite('scanVars values', () => {
    test('reads the value of CSS declarations, style-object keys and setProperty calls', () => {
        const code = `a { --css: 0 1px rgb(0 0 0 / 5%), 2px; --b: 1 } x = { '--obj': 'red', w: 1 }; el.style.setProperty('--sp', f(1, 2));`;
        assert.deepStrictEqual(
            scanVars(code).declarations.map((d) => [d.name, d.value]),
            [
                ['--css', '0 1px rgb(0 0 0 / 5%), 2px'],
                ['--b', '1'],
                ['--obj', 'red'],
                ['--sp', 'f(1, 2)'],
            ],
        );
    });
});

suite('cssRegions', () => {
    test('whole text, or only <style> contents for vue/svelte/astro', () => {
        assert.deepStrictEqual(cssRegions('abc', 'css'), [{ start: 0, end: 3 }]);
        const vue = '<p/><style scoped>a{}</style><script>x</script><style>b{}</style>';
        assert.deepStrictEqual(
            cssRegions(vue, 'vue').map((r) => vue.slice(r.start, r.end)),
            ['a{}', 'b{}'],
        );
        assert.deepStrictEqual(cssRegions('<p style="color: var(--x)"/>', 'vue'), []);
    });
});

suite('diagnostics', () => {
    suiteSetup(() => vscode.extensions.all.find((e) => e.packageJSON.name === 'varscout')!.activate());

    const config = () => vscode.workspace.getConfiguration('cssTokens');
    teardown(() => config().update('files', undefined, vscode.ConfigurationTarget.Workspace));

    const ours = (uri: vscode.Uri) => vscode.languages.getDiagnostics(uri).filter((d) => d.source === 'VarScout');

    /** Polls until `cond` holds for the diagnostics of `uri`; they are computed asynchronously. */
    const until = async (uri: vscode.Uri, cond: (d: vscode.Diagnostic[]) => boolean) => {
        for (let i = 0; i < 50; i++) {
            if (cond(ours(uri))) {
                return ours(uri);
            }
            await new Promise((r) => setTimeout(r, 100));
        }
        assert.fail(`diagnostics never matched; got ${JSON.stringify(ours(uri).map((d) => d.message))}`);
    };

    /** Names flagged in `content`. A known-bad sentinel is appended so we know the update has run. */
    const flagged = async (content: string, language = 'css') => {
        const doc = await vscode.workspace.openTextDocument({ language, content: `${content}\n.x { color: var(--sentinel) }` });
        const diags = await until(doc.uri, (d) => d.some((x) => x.message.includes('--sentinel')));
        return diags.map((d) => doc.getText(d.range)).filter((n) => n !== '--sentinel');
    };

    test('warns on unknown tokens, not on tokens from the token files', async () => {
        assert.deepStrictEqual(await flagged('a { color: var(--primary); background: var(--nope); }'), ['--nope']);
    });

    test('skips names declared in the same file and commented-out usages', async () => {
        assert.deepStrictEqual(await flagged('a { --local: 1px; width: var(--local); /* var(--ghost) */ }'), []);
    });

    test('works in SCSS (Vue/Svelte/Astro <style> handling is covered by the cssRegions test)', async () => {
        assert.deepStrictEqual(await flagged('// var(--ghost)\na { color: var(--nope) }', 'scss'), ['--nope']);
    });

    test('in TS/TSX, var() in strings and templates is checked; style objects and setProperty count as declarations', async () => {
        const code = [
            "const s = { color: 'var(--nope)', background: 'var(--primary)' };",
            'const A = styled.div`color: var(--nope2);`;',
            "el.style.setProperty('--dyn', '1');",
            "const t = { '--obj': 1, width: 'var(--obj)', height: 'var(--dyn)' }; // var(--ghost)",
        ].join('\n');
        assert.deepStrictEqual(await flagged(code, 'typescriptreact'), ['--nope', '--nope2']);
    });

    test('does not warn on names declared elsewhere in the workspace (e.g. a JSX style object)', async () => {
        assert.deepStrictEqual(await flagged('a { margin: var(--dynamic-offset); padding: var(--nope); }'), ['--nope']);
    });

    test('follows the token files: changing the setting re-checks open documents', async () => {
        // `--c` lives only in a node_modules token file, which the workspace scan never reads.
        await config().update('files', ['node_modules/pkg/tokens.css'], vscode.ConfigurationTarget.Workspace);
        const doc = await vscode.workspace.openTextDocument({ language: 'css', content: 'a { color: var(--c); }' });
        await vscode.window.showTextDocument(doc);
        await until(doc.uri, (d) => d.length === 0);
        await config().update('files', ['styles/extra.css'], vscode.ConfigurationTarget.Workspace);
        const diags = await until(doc.uri, (d) => d.length === 1);
        assert.strictEqual(doc.getText(diags[0].range), '--c');

        // No token files at all: everything would look unknown, so nothing is reported.
        await config().update('files', ['nothing/*.css'], vscode.ConfigurationTarget.Workspace);
        await until(doc.uri, (d) => d.length === 0);
    });
});
