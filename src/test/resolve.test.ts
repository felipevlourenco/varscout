import * as assert from 'assert';
import { parseTokens } from '../parser';
import { resolve } from '../resolve';

const r = (css: string, name: string) =>
    resolve(name, new Map(parseTokens(`:root { ${css} }`).map((t) => [t.name, t])));

suite('resolve', () => {
    test('plain values have no chain', () => {
        assert.deepStrictEqual(r('--a: red', '--a'), { value: 'red', chain: [] });
    });

    test('follows multi-level references', () => {
        assert.deepStrictEqual(r('--a: var(--b); --b: var(--c); --c: red', '--a'), {
            value: 'red',
            chain: ['--b', '--c'],
        });
    });

    test('substitutes inside larger values', () => {
        assert.deepStrictEqual(r('--c: red; --a: 0 0 0 1px var(--c), 0 1px var( --c )', '--a'), {
            value: '0 0 0 1px red, 0 1px red',
            chain: ['--c'],
        });
    });

    test('uses fallbacks (including nested var) only for unknown tokens', () => {
        assert.strictEqual(r('--a: var(--nope, #fff)', '--a').value, '#fff');
        assert.strictEqual(r('--c: red; --a: var(--nope, var(--c))', '--a').value, 'red');
        assert.strictEqual(r('--c: red; --a: var(--c, blue)', '--a').value, 'red');
        assert.strictEqual(r('--a: var(--nope, rgb(0, 0, 0))', '--a').value, 'rgb(0, 0, 0)');
    });

    test('leaves unknown references and cycles unresolved', () => {
        assert.strictEqual(r('--a: var(--nope)', '--a').value, 'var(--nope)');
        assert.strictEqual(r('--a: var(--b); --b: var(--a)', '--a').value, 'var(--a)');
        assert.strictEqual(r('--a: var(--a)', '--a').value, 'var(--a)');
    });
});
