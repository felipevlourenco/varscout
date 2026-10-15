import { parse } from 'postcss';

export interface Token {
    name: string;
    value: string;
}

/** Every `--custom-property` declaration in `css`, in source order (including inside @media etc.). Throws on invalid CSS. */
export function parseTokens(css: string): Token[] {
    const tokens: Token[] = [];
    // decl.value already has comments stripped; collapse the whitespace of multi-line values.
    parse(css).walkDecls(/^--/, (decl) => {
        tokens.push({ name: decl.prop, value: decl.value.replace(/\s+/g, ' ').trim() });
    });
    return tokens;
}
