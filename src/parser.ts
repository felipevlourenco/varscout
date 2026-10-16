import { AtRule, Node, parse, Rule } from 'postcss';

export interface Token {
    name: string;
    value: string;
    /** 0-based position of the property name in the source. */
    line: number;
    column: number;
    /** Enclosing at-rules and selectors, outermost first, e.g. `@media (prefers-color-scheme: dark) :root`. */
    context: string;
}

/** Selector / at-rule chain around a node. `@layer` is skipped: it doesn't change when a value applies. */
function contextOf(node: Node): string {
    const parts: string[] = [];
    for (let n = node.parent as Node | undefined; n && n.type !== 'root'; n = n.parent as Node | undefined) {
        if (n.type === 'rule') {
            parts.unshift((n as Rule).selector);
        } else if (n.type === 'atrule' && (n as AtRule).name !== 'layer') {
            const { name, params } = n as AtRule;
            parts.unshift(`@${name} ${params}`);
        }
    }
    return parts.join(' ').replace(/\s+/g, ' ').trim();
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
            context: contextOf(decl),
        });
    });
    return tokens;
}
