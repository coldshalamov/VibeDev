// =============================================================================
// VibeDev VS Code Extension - Main Entry Point
// =============================================================================

import * as vscode from 'vscode';
import { MissionControlProvider } from './views/MissionControlProvider';
import { AutopromptEngine } from './autoprompt/AutopromptEngine';
import { VibedDevClient } from './client/VibedDevClient';
import { StatusBarController } from './ui/StatusBarController';

let autopromptEngine: AutopromptEngine;
let statusBarController: StatusBarController;
let client: VibedDevClient;

export function activate(context: vscode.ExtensionContext) {
    console.log('VibeDev Mission Control activated');

    // Initialize client
    const config = vscode.workspace.getConfiguration('vibedev');
    const serverUrl = config.get<string>('serverUrl') || 'http://127.0.0.1:8765';
    client = new VibedDevClient(serverUrl);

    // Initialize autoprompt engine
    autopromptEngine = new AutopromptEngine(client, context);

    // Initialize status bar
    statusBarController = new StatusBarController(client);
    context.subscriptions.push(statusBarController);

    // Register webview provider for Mission Control sidebar
    const missionControlProvider = new MissionControlProvider(
        context.extensionUri,
        client,
        autopromptEngine
    );

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            'vibedev.missionControl',
            missionControlProvider,
            { webviewOptions: { retainContextWhenHidden: true } }
        )
    );

    // Register commands
    registerCommands(context);

    // Start polling for job updates
    statusBarController.startPolling();

    vscode.window.showInformationMessage('VibeDev Mission Control ready 🚀');
}

function registerCommands(context: vscode.ExtensionContext) {
    // Next Step command
    context.subscriptions.push(
        vscode.commands.registerCommand('vibedev.nextStep', async () => {
            try {
                const jobId = await client.getCurrentJobId();
                if (!jobId) {
                    vscode.window.showWarningMessage('No active VibeDev job');
                    return;
                }

                const response = await client.getNextPrompt(jobId);

                if (response.action === 'JOB_COMPLETE') {
                    vscode.window.showInformationMessage('🎉 Job complete!');
                    return;
                }

                // Copy prompt to clipboard
                await vscode.env.clipboard.writeText(response.prompt);

                const action = await vscode.window.showInformationMessage(
                    `Step prompt copied to clipboard. Paste into chat?`,
                    'Paste Now',
                    'Manual'
                );

                if (action === 'Paste Now') {
                    await pasteIntoChat(response.prompt);
                }
            } catch (error) {
                vscode.window.showErrorMessage(`VibeDev error: ${error}`);
            }
        })
    );

    // Start Autoprompt command
    context.subscriptions.push(
        vscode.commands.registerCommand('vibedev.startAutoprompt', async () => {
            const jobId = await client.getCurrentJobId();
            if (!jobId) {
                vscode.window.showWarningMessage('No active VibeDev job');
                return;
            }

            const config = vscode.workspace.getConfiguration('vibedev.autoprompt');
            if (!config.get<boolean>('enabled')) {
                const enable = await vscode.window.showWarningMessage(
                    'Autoprompt is disabled. Enable in settings?',
                    'Enable',
                    'Cancel'
                );
                if (enable === 'Enable') {
                    await config.update('enabled', true, vscode.ConfigurationTarget.Global);
                } else {
                    return;
                }
            }

            await autopromptEngine.start(jobId);
        })
    );

    // Stop Autoprompt command
    context.subscriptions.push(
        vscode.commands.registerCommand('vibedev.stopAutoprompt', async () => {
            autopromptEngine.stop();
            vscode.window.showInformationMessage('Autoprompt stopped');
        })
    );

    // Submit Evidence command
    context.subscriptions.push(
        vscode.commands.registerCommand('vibedev.submitEvidence', async () => {
            const jobId = await client.getCurrentJobId();
            if (!jobId) {
                vscode.window.showWarningMessage('No active VibeDev job');
                return;
            }

            // Open input box for evidence
            const evidence = await vscode.window.showInputBox({
                prompt: 'Enter evidence (JSON format)',
                placeHolder: '{"changed_files": ["src/foo.ts"], "tests_passed": true}',
                validateInput: (text) => {
                    try {
                        JSON.parse(text);
                        return null;
                    } catch {
                        return 'Invalid JSON';
                    }
                }
            });

            if (evidence) {
                try {
                    const result = await client.submitEvidence(jobId, JSON.parse(evidence));
                    if (result.accepted) {
                        vscode.window.showInformationMessage('✅ Evidence accepted');
                    } else {
                        vscode.window.showWarningMessage(`❌ Rejected: ${result.feedback}`);
                    }
                } catch (error) {
                    vscode.window.showErrorMessage(`Error: ${error}`);
                }
            }
        })
    );

    // Open Dashboard command
    context.subscriptions.push(
        vscode.commands.registerCommand('vibedev.openDashboard', () => {        
            const config = vscode.workspace.getConfiguration('vibedev');
            const dashboardUrl =
                config.get<string>('dashboardUrl') || 'http://localhost:3000';
            vscode.env.openExternal(vscode.Uri.parse(dashboardUrl));
        })
    );

    // Refresh Status command
    context.subscriptions.push(
        vscode.commands.registerCommand('vibedev.refreshStatus', async () => {
            await statusBarController.refresh();
        })
    );
}

async function pasteIntoChat(text: string): Promise<void> {
    // Copy to clipboard
    await vscode.env.clipboard.writeText(text);

    // Try to paste into active editor
    const editor = vscode.window.activeTextEditor;
    if (editor) {
        await vscode.commands.executeCommand('editor.action.clipboardPasteAction');
    } else {
        vscode.window.showInformationMessage('Prompt copied. Paste into chat manually.');
    }
}

export function deactivate() {
    if (autopromptEngine) {
        autopromptEngine.stop();
    }
    if (statusBarController) {
        statusBarController.dispose();
    }
}
