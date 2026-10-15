import * as assert from 'assert';
import { parseTokens } from '../parser';

suite('parseTokens', () => {
    test('extracts name and value, ignoring regular properties', () => {
        assert.deepStrictEqual(parseTokens(':root { --a: #fff; color: red; --b: 1rem }'), [
            { name: '--a', value: '#fff' },
            { name: '--b', value: '1rem' },
        ]);
    });

    test('ignores commented-out tokens and strips comments inside values', () => {
        const css = `:root {
            /* --fake: 1; */
            --a: red /* inline */ blue;
        }`;
        assert.deepStrictEqual(parseTokens(css), [{ name: '--a', value: 'red blue' }]);
    });

    test('collapses multi-line values', () => {
        const css = `:root { --shadow:
            0 1px 2px rgb(0 0 0 / 10%),
            0 4px 8px rgb(0 0 0 / 20%);
        }`;
        assert.deepStrictEqual(parseTokens(css), [
            { name: '--shadow', value: '0 1px 2px rgb(0 0 0 / 10%), 0 4px 8px rgb(0 0 0 / 20%)' },
        ]);
    });

    test('finds tokens inside @media and keeps redefinitions', () => {
        const css = `:root { --bg: white }
        @media (prefers-color-scheme: dark) { :root { --bg: black } }`;
        assert.deepStrictEqual(parseTokens(css), [
            { name: '--bg', value: 'white' },
            { name: '--bg', value: 'black' },
        ]);
    });

    test('keeps references and case-sensitive names', () => {
        assert.deepStrictEqual(parseTokens(':root { --Primary: var(--blue-500, #00f) }'), [
            { name: '--Primary', value: 'var(--blue-500, #00f)' },
        ]);
    });
});
