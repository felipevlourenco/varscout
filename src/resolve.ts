import { Token } from './parser';

/**
 * Expands every `var(--x[, fallback])` in `value` through `onRef(name, fallback, raw)`.
 * Hand-rolled because fallbacks can contain nested parentheses.
 */
function expand(value: string, onRef: (name: string, fallback: string | undefined, raw: string) => string): string {
    let out = '';
    let i = 0;
    while (i < value.length) {
        const j = value.indexOf('var(', i);
        if (j < 0) {
            return out + value.slice(i);
        }
        if (j > 0 && /[\w-]/.test(value[j - 1])) {
            out += value.slice(i, j + 4); // e.g. `somevar(`, not a var() call
            i = j + 4;
            continue;
        }
        let depth = 1;
        let k = j + 4;
        while (k < value.length && depth) {
            depth += value[k] === '(' ? 1 : value[k] === ')' ? -1 : 0;
            k++;
        }
        if (depth) {
            return out + value.slice(i); // unbalanced, leave as is
        }
        const inner = value.slice(j + 4, k - 1);
        const comma = inner.indexOf(',');
        const name = (comma < 0 ? inner : inner.slice(0, comma)).trim();
        const fallback = comma < 0 ? undefined : inner.slice(comma + 1).trim();
        out += value.slice(i, j) + onRef(name, fallback, value.slice(j, k));
        i = k;
    }
    return out;
}

/**
 * Final value of `value` (a declaration of the token `self`) with all `var()` references substituted, plus the names it passed through
 * (depth-first, in discovery order). Unknown references without a fallback and cycles are left as `var(--x)`.
 */
export function resolveValue(
    value: string,
    tokens: Map<string, Token>,
    self: string,
): { value: string; chain: string[] } {
    const chain: string[] = [];
    const walk = (value: string, stack: string[]): string =>
        expand(value, (ref, fallback, raw) => {
            const token = tokens.get(ref);
            if (!token) {
                return fallback === undefined ? raw : walk(fallback, stack);
            }
            if (stack.includes(ref)) {
                return raw; // cycle
            }
            if (!chain.includes(ref)) {
                chain.push(ref);
            }
            return walk(token.value, [...stack, ref]);
        });
    return { value: walk(value, [self]), chain };
}

export const resolve = (name: string, tokens: Map<string, Token>) =>
    resolveValue(tokens.get(name)?.value ?? '', tokens, name);
