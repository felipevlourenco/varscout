import * as assert from 'assert';
import { parseTokens, Token } from '../parser';
import { buildThemeMaps, themeValues } from '../themes';

const values = (css: string, name: string) => {
    const all = new Map<string, Token[]>();
    for (const t of parseTokens(css)) {
        all.set(t.name, [...(all.get(t.name) ?? []), t]);
    }
    return themeValues(name, buildThemeMaps(all)).map((e) => [e.theme, e.value]);
};

suite('themeValues', () => {
    test('a value per theme, default first even if it is declared later', () => {
        const css = `.dark { --a: black } :root { --a: white } [data-theme="light"] { --a: ivory }`;
        assert.deepStrictEqual(values(css, '--a'), [
            ['default', 'white'],
            ['.dark', 'black'],
            ['[data-theme="light"]', 'ivory'],
        ]);
    });

    test('labels media queries and treats a :root selector list as default', () => {
        const css = `:root, .light { --a: white }
        @media (prefers-color-scheme: dark) { :root { --a: black } }`;
        assert.deepStrictEqual(values(css, '--a'), [
            ['default', 'white'],
            ['@media (prefers-color-scheme: dark) :root', 'black'],
        ]);
    });

    test('references follow the theme: only the referenced token is redefined', () => {
        const css = `:root { --a: white; --b: var(--a) } .dark { --a: black }`;
        assert.deepStrictEqual(values(css, '--b'), [
            ['default', 'white'],
            ['.dark', 'black'],
        ]);
    });

    test('themes with the same value are not repeated', () => {
        assert.deepStrictEqual(values(`:root { --a: 1 } .dark { --a: 1 }`, '--a'), [['default', '1']]);
    });

    test('a token defined only in a theme shows that theme; unknown tokens show nothing', () => {
        assert.deepStrictEqual(values(`.dark { --only: 1 }`, '--only'), [['.dark', '1']]);
        assert.deepStrictEqual(values(`:root { --a: 1 }`, '--nope'), []);
    });
});
