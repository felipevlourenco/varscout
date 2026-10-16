# VarScout

Autocomplete, hover, go-to-definition and diagnostics for your design tokens.

VarScout reads the CSS file(s) where you define your tokens (CSS custom properties such as `--color-primary`) and makes them available in every other style file of the project. Each suggestion shows the token's **name and its actual value**, so you can see what you are picking without opening the token file.

## Quick start

1. Define your tokens in a file named `tokens.css` anywhere in the workspace:

   ```css
   :root {
     --blue-500: #3b82f6;
     --primary: var(--blue-500);
     --space-4: 1rem;
   }

   .dark {
     --blue-500: #60a5fa;
   }
   ```

2. In any CSS, SCSS, Less, Vue, Svelte, Astro, JS or TS file, type `var(` or `--` where a value goes.

   ```css
   .button {
     color: var(--primary);   /* ← suggestions appear as you type */
     padding: var(--space-4);
   }
   ```

   Your token file is somewhere else or has another name? Set [`cssTokens.files`](#settings).

## Features

### Autocomplete

- Suggestions appear after `var(` and when you type a word starting with `--` in a value position. They don't appear when you are *declaring* a new property (`--my-token: …`).
- **Name and value.** Each item shows the token name and its value.
- **Color swatches.** Color tokens use the Color item kind, with the color in the documentation, so VS Code draws a swatch. Two limits from VS Code itself: swatches only render for `#rgb`, `#rrggbb` and comma-style `rgb()`/`hsl()`/`rgba()`/`hsla()`; other formats (`oklch()`, `#rrggbbaa`, `rgb(0 0 0 / 50%)`) get the color icon without a swatch.
- **References are resolved.** For `--primary: var(--blue-500)` you see the final value (`#3b82f6`) and the chain (`--primary → --blue-500`). Fallbacks (`var(--x, 1px)`) are used only when the token doesn't exist; cycles are left as written.
- **Context-aware insertion.** Accepting a token while typing a value inserts `var(--name)`. If you are already inside `var(`, it inserts just `--name`.
- **Grouped by prefix.** Tokens are sorted by their first name segment (`--color-*`, `--space-*`…), and that category is shown next to the value (`space · 1rem (16px)`). Numbers sort as numbers (`--space-2` before `--space-10`). Tokens without a prefix (`--primary`) come last.
- **px for rem.** `rem` values are shown with their px size, e.g. `1.5rem (24px)`. Only top-level lengths are converted, not those inside `calc()` or `clamp()`. Set [`cssTokens.rootFontSize`](#settings) if your root isn't 16px.

### Hover

Hover the token name inside `var(--x)` to see its resolved value, the reference chain, and its value under each theme.

### Go to definition

Cmd/Ctrl+click on the token name inside `var(--x)` jumps to where it is declared. If it is declared more than once (for example once per theme), VS Code shows all declarations.

### Themes

Tokens redefined under another selector or condition (`.dark`, `[data-theme="dark"]`, `@media (prefers-color-scheme: dark)`…) show **a value per theme** in hover and in the completion documentation:

```
default: #3b82f6
.dark: #60a5fa
```

Themes are resolved as a whole: if only `--blue-500` is redefined in `.dark`, then `--primary` (which references it) also shows a different dark value. A theme is any selector or at-rule around the declaration; `:root`, `html`, `*` and `:host` (also in a list like `:root, .light`) count as the default. `@layer` is ignored.

### Diagnostics

`var(--x)` where `--x` is in none of your token files gets a warning: `Unknown CSS variable "--x"`. Not reported:

- names declared in the same file (`--local: 4px; … var(--local)`);
- usages inside comments;
- everything, when no token files are found at all (so a wrong `cssTokens.files` doesn't flood the file with warnings).

In JS/TS, names set with `style.setProperty('--x', …)` or a `'--x':` style-object key count as declared.

### Quick fix: hardcoded value → token

Put the cursor on a hardcoded value and open Quick Fixes (Cmd/Ctrl+.) to replace it with a token that has the same value:

```css
color: #3b82f6;   →   Replace #3b82f6 with var(--blue-500)
padding: 1rem;    →   Replace 1rem with var(--space-4)
```

Colors, dimensions (`1rem`, `16px`) and multi-part values (a whole `box-shadow`, a function call) are matched, ignoring case, spacing and `#fff` vs `#ffffff`. Tokens declared with exactly that value come first, then ones that reach it through a reference. Bare numbers and keywords (`0`, `auto`) are never suggested. Matching uses the default (no-theme) value, one line at a time.

### Stays up to date

Saving, creating or deleting a token file refreshes suggestions, hover and diagnostics, with no reload. Parsed files are cached and re-parsed only when they change, so large token files stay fast.

### Where it works

| Language | Where tokens are offered |
| --- | --- |
| CSS, SCSS, Less | Everywhere |
| Vue, Svelte, Astro | Inside `<style>` blocks only (Svelte and Astro need their own language extension installed) |
| JavaScript, TypeScript, JSX, TSX | Inside styled-components style templates: `` styled.div`…` ``, `` styled(Button)`…` ``, `.attrs(...)`, `` css`…` ``, `` keyframes`…` ``, `createGlobalStyle`, `injectGlobal`. Everywhere else only after `var(` inside a string, such as `style={{ color: 'var(--x)' }}` |

The quick fix works in CSS-like files and inside styled templates, not in plain JS/TS style objects.

### Token files from packages

A design system installed as a package works too. Besides workspace paths and globs, `cssTokens.files` accepts a file inside a package, looked up like Node does (in the nearest `node_modules` of the workspace folder or one of its parents):

```json
{ "cssTokens.files": ["@acme/design-tokens/dist/tokens.css"] }
```

`node_modules` is skipped by globs unless the entry names it (`node_modules/**/*.css`).

### Multi-root workspaces

Each workspace folder has its own token files and tokens. A file sees only the tokens of the folder it belongs to, and each folder can set `cssTokens.files` and `cssTokens.rootFontSize` in its own `.vscode/settings.json`. Files outside any folder (and untitled documents) use the first folder.

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `cssTokens.files` | `["**/tokens.css"]` | Token files: paths or globs relative to each workspace folder, absolute paths, or a file inside an installed package (`@scope/pkg/file.css`). Multiple entries are merged. Can be set per folder. |
| `cssTokens.rootFontSize` | `16` | Size of `1rem` in px, for the px equivalents. Can be set per folder. |

## Commands

| Command | What it does |
| --- | --- |
| **VarScout: Reload Tokens** | Re-reads all token files and re-checks open files. Use it after installing or updating a package, because VS Code doesn't watch `node_modules`. |
| **VarScout: Show Parsed Tokens** | Lists what was parsed from each token file (per folder) in the Output panel. Useful to check that your `cssTokens.files` setting finds the right files. |

## How it works

1. **Find.** `cssTokens.files` is resolved per workspace folder to a list of files.
2. **Parse.** Each file is parsed with [PostCSS](https://postcss.org) (no regular expressions on the CSS), collecting every `--custom-property` with its value, position, and enclosing selector or at-rule. Comments are ignored and multi-line values are collapsed. Parses are cached by modification time and size.
3. **Resolve.** For every token, references are expanded recursively, once for the default theme and once per theme found in your files.
4. **Serve.** Completion, hover, definition, diagnostics and the quick fix read from that per-folder token set. A file watcher drops the changed file's cache entry and rebuilds the set when a token file changes.

## Known limitations

- Only **saved** changes to a token file are picked up, not unsaved edits.
- Files inside `node_modules` aren't watched by VS Code. Run **VarScout: Reload Tokens** after updating a package.
- Any condition counts as a "theme", so `@media (min-width: 40em)` is listed like a dark theme would be.
- Warnings are given for variables set at runtime from JavaScript in ways VarScout can't see. Add the file that declares them to `cssTokens.files`, or declare them with `setProperty`.
- VS Code's own CSS support also suggests the variables declared in the current file, so you may see some names twice. This extension can't turn that off.
- The Vue, Svelte, Astro and CSS-in-JS handling is lightweight: it finds `<style>` blocks and the template tags listed above, not every possible syntax (e.g. `<style jsx>`).

## Requirements

VS Code 1.140 or newer.

## Development

```bash
pnpm install
pnpm dev          # compiles and opens an Extension Development Host on test-fixtures/ws
pnpm dev:multi    # same, on a two-folder workspace (test-fixtures/multi.code-workspace)
pnpm test         # compiles, lints and runs the single-root and multi-root test suites
```

The `test-fixtures/ws/styles` folder has small files (`demo.css`, `demo.vue`, `demo.tsx`) with comments describing what to try in each.

Source layout (`src/`):

| File | Role |
| --- | --- |
| `extension.ts` | Activation: registers the providers, commands and watchers |
| `tokenFiles.ts` | Resolves `cssTokens.files` and watches the files |
| `parser.ts` | PostCSS parsing of token files |
| `tokens.ts` | Per-folder token store and parse cache |
| `resolve.ts`, `themes.ts` | `var()` resolution and per-theme values |
| `completion.ts`, `hover.ts`, `definition.ts`, `diagnostics.ts`, `quickfix.ts` | The editor features |
| `languages.ts`, `usage.ts` | Where CSS can appear in each language, and `var(--x)` detection |
| `rem.ts` | px equivalents for `rem` |
