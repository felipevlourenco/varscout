import { defineConfig } from '@vscode/test-cli';

export default defineConfig([
	{ label: 'single-root', files: 'out/test/*.test.js', workspaceFolder: 'test-fixtures/ws' },
	{ label: 'multi-root', files: 'out/test/multi/*.test.js', workspaceFolder: 'test-fixtures/multi.code-workspace' },
]);
