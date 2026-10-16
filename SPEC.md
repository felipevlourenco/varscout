# CSS Tokens Autocomplete — VS Code Extension

## Goal
Read a main design-tokens CSS file (e.g. `tokens.css`) and expose its CSS custom properties in autocomplete across all other style files. Every suggestion shows the **variable name and its value**, so developers know exactly what they're picking.

## Tech
- TypeScript, scaffolded with `yo code` ("New Extension (TypeScript)")
- PostCSS for parsing (no regex)
- VS Code APIs: `CompletionItemProvider`, `HoverProvider`, `DefinitionProvider`, `FileSystemWatcher`, `DiagnosticCollection`, `CodeActionProvider`

## Settings
- `cssTokens.files`: array of paths/globs to token files (default: `["**/tokens.css"]`)

## Phase 1 — MVP
- [x] **Configurable token source**: read paths/globs from `cssTokens.files`; support multiple files
- [x] **Parser**: extract every `--custom-property` and its value with PostCSS; handle comments, multi-line values and `@media` blocks
- [x] **Completion provider**: trigger on `--` and inside `var(`; label = variable name, `detail` = value
- [x] **Context-aware insertion**: insert `var(--x)` as a property value, just `--x` when already inside `var(`
- [x] **Color swatches**: use `CompletionItemKind.Color` with the color value as documentation so VS Code renders a swatch
- [x] **Resolve references**: if `--primary: var(--blue-500)`, show the final resolved value (and the reference chain)
- [x] **Live updates**: file watcher re-parses token files on change
- [x] **Languages**: CSS, SCSS, Less, and `<style>` blocks in Vue / Svelte / Astro

## Phase 2
- [x] **Hover**: hovering `var(--x)` shows its value (all theme values if several)
- [x] **Go to definition**: Cmd/Ctrl+click jumps to the token's declaration
- [ ] **Theme awareness**: tokens redefined under `[data-theme="dark"]`, `.dark`, etc. show a value per theme
- [ ] **Diagnostics**: warn on `--var` usages that don't exist in the token files
- [ ] **Hardcoded value → token quick fix**: e.g. `color: #3b82f6` → suggest replacing with `var(--blue-500)`

## Phase 3 — Polish
- [ ] Group/sort by prefix (`--color-*`, `--space-*`) and show category
- [ ] Show px equivalent for rem values, e.g. `1.5rem (24px)`
- [ ] Support token files from `node_modules` (design system shipped as a package)
- [ ] Support CSS-in-JS and TS/TSX (styled-components, inline `style`)
- [ ] Multi-root workspaces, each with its own token files
- [ ] Cache parsed results for large token files

## Differentiators vs existing extensions (e.g. "CSS Variable Autocomplete")
Resolved values, theme-aware hover, and the hardcoded-value-to-token quick fix.
