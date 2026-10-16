import { Token } from './parser';
import { resolve } from './resolve';

const ROOT = /^(:root|html|\*|:host)?$/;

/** `default` for declarations that always apply (`:root`, `html`, `*`, also in a list like `:root, .light`), otherwise the selector / at-rule context. */
export const themeLabel = (t: Token) => (t.context.split(',').some((part) => ROOT.test(part.trim())) ? 'default' : t.context);

/** The definition shown when no theme is active: the `default` one, else the first. */
export const representative = <T extends Token>(defs: T[]): T => defs.find((d) => themeLabel(d) === 'default') ?? defs[0];

/** Theme label -> (token name -> the definition in effect under that theme). `default` is always first. */
export type ThemeMaps<T extends Token = Token> = Map<string, Map<string, T>>;

export function buildThemeMaps<T extends Token>(all: Map<string, T[]>): ThemeMaps<T> {
    const labels = new Set([...all.values()].flatMap((defs) => defs.map(themeLabel)));
    labels.delete('default');
    const maps: ThemeMaps<T> = new Map();
    for (const label of ['default', ...labels]) {
        maps.set(
            label,
            new Map([...all].map(([name, defs]) => [name, defs.find((d) => themeLabel(d) === label) ?? representative(defs)])),
        );
    }
    return maps;
}

/**
 * Final value of `name` with no theme active, followed by one entry per theme where it differs.
 * Themes are resolved as a whole, so `--primary: var(--blue)` changes when only `--blue` is redefined.
 */
export function themeValues(name: string, maps: ThemeMaps): { theme: string; value: string; chain: string[] }[] {
    const base = maps.get('default')?.get(name);
    if (!base) {
        return [];
    }
    const entries = [{ theme: themeLabel(base), ...resolve(name, maps.get('default')!) }];
    for (const [theme, map] of maps) {
        const r = resolve(name, map);
        if (theme !== 'default' && theme !== entries[0].theme && r.value !== entries[0].value) {
            entries.push({ theme, ...r });
        }
    }
    return entries;
}
