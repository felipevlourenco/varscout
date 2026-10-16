import { parse } from 'postcss';

export interface Token {
    name: string;
    value: string;
    /** 0-based position of the property name in the source. */
    line: number;
    column: number;
}

/** Every `--custom-property` declaration in `css`, in source order (including inside @media etc.). Throws on invalid CSS. */
export function parseTokens(css: string): Token[] {
    const tokens: Token[] = [];
    // decl.value already has comments stripped; collapse the whitespace of multi-line values.
    parse(css).walkDecls(/^--/, (decl) => {
        const start = decl.source?.start;
        tokens.push({
            name: decl.prop,
            value: decl.value.replace(/\s+/g, ' ').trim(),
            line: (start?.line ?? 1) - 1,
            column: (start?.column ?? 1) - 1,
        });
    });
    return tokens;
}
