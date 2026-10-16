import * as vscode from 'vscode';

// Root hook: start every run from default settings, whatever a manual `pnpm dev` session left in the fixture workspace.
suiteSetup(async () => {
    const config = vscode.workspace.getConfiguration('cssTokens');
    for (const key of ['files', 'rootFontSize']) {
        await config.update(key, undefined, vscode.ConfigurationTarget.Workspace);
    }
});
