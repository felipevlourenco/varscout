import * as assert from 'assert';
import { templateRegions } from '../languages';

suite('templateRegions', () => {
    const regions = (text: string) => templateRegions(text).map((r) => text.slice(r.start, r.end));

    test('finds CSS-in-JS tagged templates', () => {
        const text = [
            'const A = styled.div`\n  color: ${(p) => p.c};\n  &:hover { background: var(--x); }\n`;',
            'const b = css`margin: 0;`;',
            'const C = styled(Button)<Props>`padding: 1rem;`;',
            'const D = styled.a.attrs({ x: 1 })`top: 0`;',
            'const E = `not css`; const F = html`<p>${x}</p>`;',
            'const G = createGlobalStyle`body { margin: 0 }`; const H = keyframes`from { top: 0 }`;',
        ].join('\n');
        assert.deepStrictEqual(regions(text), [
            '\n  color: ${(p) => p.c};\n  &:hover { background: var(--x); }\n',
            'margin: 0;',
            'padding: 1rem;',
            'top: 0',
            'body { margin: 0 }',
            'from { top: 0 }',
        ]);
    });

    test('handles braces, strings and nested templates inside ${}', () => {
        const text = "styled.div`a: ${ { k: '`}' }.k }; b: ${(p) => css`c: 1;`}; d: 2;` const z = 1;";
        const outer = templateRegions(text)[0];
        assert.strictEqual(text.slice(outer.start, outer.end), "a: ${ { k: '`}' }.k }; b: ${(p) => css`c: 1;`}; d: 2;");
    });

    test('an unterminated template runs to the end of the text', () => {
        const text = 'const A = styled.div`color: red;\n  padding: ';
        assert.deepStrictEqual(regions(text), ['color: red;\n  padding: ']);
    });
});
