# Change Log

All notable changes to the "varscout" extension are documented in this file.

## [0.1.1]

- Add the extension icon
- Add screenshots and a demo GIF to the README

## [0.1.0]

First release.

- Autocomplete for CSS custom properties from your token files, with name, value, color swatches, resolved `var()` references, grouping by prefix and px equivalents for `rem`
- Hover, go to definition and a per-theme value for tokens redefined under `.dark`, `[data-theme]`, `@media`…
- Warnings for `var(--x)` that isn't defined in any token file
- Quick fix to replace a hardcoded value with a token that has the same value
- Works in CSS, SCSS, Less, Vue / Svelte / Astro `<style>` blocks, and in JS / TS (styled-components templates and `var()` in strings)
- Token files from `node_modules` packages, multi-root workspaces, live updates and a parse cache
- Settings `cssTokens.files` and `cssTokens.rootFontSize`; commands **VarScout: Reload Tokens** and **VarScout: Show Parsed Tokens**
