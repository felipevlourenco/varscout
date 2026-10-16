import * as assert from 'assert';
import { parseTokens } from '../parser';

const pairs = (css: string) => parseTokens(css).map(({ name, value }) => ({ name, value }));

suite('parseTokens', () => {
    test('extracts name and value, ignoring regular properties', () => {
        assert.deepStrictEqual(pairs(':root { --a: #fff; color: red; --b: 1rem }'), [
            { name: '--a', value: '#fff' },
            { name: '--b', value: '1rem' },
        ]);
    });

    test('ignores commented-out tokens and strips comments inside values', () => {
        const css = `:root {
            /* --fake: 1; */
            --a: red /* inline */ blue;
        }`;
        assert.deepStrictEqual(pairs(css), [{ name: '--a', value: 'red blue' }]);
    });

    test('collapses multi-line values', () => {
        const css = `:root { --shadow:
            0 1px 2px rgb(0 0 0 / 10%),
            0 4px 8px rgb(0 0 0 / 20%);
        }`;
        assert.deepStrictEqual(pairs(css), [
            { name: '--shadow', value: '0 1px 2px rgb(0 0 0 / 10%), 0 4px 8px rgb(0 0 0 / 20%)' },
        ]);
    });

    test('finds tokens inside @media and keeps redefinitions', () => {
        const css = `:root { --bg: white }
        @media (prefers-color-scheme: dark) { :root { --bg: black } }`;
        assert.deepStrictEqual(pairs(css), [
            { name: '--bg', value: 'white' },
            { name: '--bg', value: 'black' },
        ]);
    });

    test('keeps references and case-sensitive names', () => {
        assert.deepStrictEqual(pairs(':root { --Primary: var(--blue-500, #00f) }'), [
            { name: '--Primary', value: 'var(--blue-500, #00f)' },
        ]);
    });

    test('records the 0-based position of each name', () => {
        const css = ':root {\n  --a: 1;\n}\n@media print { :root { --b: 2 } }';
        assert.deepStrictEqual(
            parseTokens(css).map(({ name, line, column }) => [name, line, column]),
            [
                ['--a', 1, 2],
                ['--b', 3, 23],
            ],
        );
    });

    test('records the selector / at-rule context, skipping @layer', () => {
        const css = `:root { --a: 1 }
        .dark,
        [data-theme="dark"] { --b: 2 }
        @layer tokens { @media (min-width: 40em) { :root { --c: 3 } } }`;
        assert.deepStrictEqual(
            parseTokens(css).map(({ name, context }) => [name, context]),
            [
                ['--a', ':root'],
                ['--b', '.dark, [data-theme="dark"]'],
                ['--c', '@media (min-width: 40em) :root'],
            ],
        );
    });
});
