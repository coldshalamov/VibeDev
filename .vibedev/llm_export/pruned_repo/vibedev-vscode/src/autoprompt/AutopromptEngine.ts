// =============================================================================
// Autoprompt Engine - Autonomous Execution Loop
// =============================================================================

import * as vscode from 'vscode';
import { VibedDevClient } from '../client/VibedDevClient';

export class AutopromptEngine {
    private isRunning = false;
    private currentJobId: string | null = null;
    private abortController: AbortController | null = null;
    private statusBarItem: vscode.StatusBarItem;

    constructor(
        private client: VibedDevClient,
        private context: vscode.ExtensionContext
    ) {
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            100
        );
        this.statusBarItem.command = 'vibedev.stopAutoprompt';
        this.context.subscriptions.push(this.statusBarItem);
    }

    async start(jobId: string): Promise<void> {
        if (this.isRunning) {
            vscode.window.showWarningMessage('Autoprompt already running');
            return;
        }

        this.isRunning = true;
        this.currentJobId = jobId;
        this.abortController = new AbortController();

        this.statusBarItem.text = '$(loading~spin) VibeDev Autoprompt';
        this.statusBarItem.tooltip = 'Click to stop';
        this.statusBarItem.show();

        vscode.window.showInformationMessage(
            '🚀 Autoprompt started. Press ESC or click status bar to stop.',
            'Stop'
        ).then((action) => {
            if (action === 'Stop') {
                this.stop();
            }
        });

        try {
            await this.runLoop();
        } catch (error) {
            vscode.window.showErrorMessage(`Autoprompt error: ${error}`);
        } finally {
            this.cleanup();
        }
    }

    stop(): void {
        if (this.abortController) {
            this.abortController.abort();
        }
        this.isRunning = false;
        this.cleanup();
        vscode.window.showInformationMessage('Autoprompt stopped');
    }

    private async runLoop(): Promise<void> {
        const config = vscode.workspace.getConfiguration('vibedev.autoprompt');
        const autoSend = config.get<boolean>('autoSend') ?? false;
        const delayMs = config.get<number>('delayMs') ?? 1000;
        const pauseOnDiagnose = config.get<boolean>('pauseOnDiagnose') ?? true;

        let stepCount = 0;

        while (this.isRunning && this.currentJobId) {
            // Check if aborted
            if (this.abortController?.signal.aborted) {
                break;
            }

            stepCount++;
            this.statusBarItem.text = `$(loading~spin) VibeDev Step ${stepCount}`;

            try {
                // Get next prompt
                const response = await this.client.getNextPrompt(this.currentJobId);

                // Handle different actions
                if (response.action === 'JOB_COMPLETE') {
                    vscode.window.showInformationMessage('🎉 Job complete!');
                    break;
                }

                if (response.action === 'AWAIT_HUMAN') {
                    vscode.window.showWarningMessage('⏸️ Job requires human approval. Autoprompt paused.');
                    break;
                }

                if (response.action === 'DIAGNOSE' && pauseOnDiagnose) {
                    vscode.window.showWarningMessage('⚠️ Entering diagnose mode. Autoprompt paused.');
                    break;
                }

                if (response.action === 'NEW_THREAD') {
                    // New thread needed
                    const action = await vscode.window.showInformationMessage(
                        '🔄 VibeDev needs a new thread. Continue?',
                        'Start New Thread',
                        'Stop Autoprompt'
                    );

                    if (action === 'Start New Thread') {
                        await this.startNewThread(response.prompt || '');
                    } else {
                        break;
                    }
                }

                if (!response.prompt) {
                    vscode.window.showWarningMessage('No prompt returned. Stopping.');
                    break;
                }

                // Paste prompt
                await vscode.env.clipboard.writeText(response.prompt);

                if (autoSend) {
                    // Try to paste and send
                    await this.pasteAndSend(response.prompt);
                } else {
                    // Just notify user to paste
                    vscode.window.showInformationMessage(
                        'Prompt copied to clipboard. Paste into chat and send.',
                        'Pasted'
                    );
                }

                // Wait for response completion
                await this.waitForCompletion(delayMs);

                // Brief pause before next iteration
                await this.sleep(delayMs);

            } catch (error) {
                vscode.window.showErrorMessage(`Step error: ${error}`);
                break;
            }
        }
    }

    private async pasteAndSend(text: string): Promise<void> {
        // Copy to clipboard
        await vscode.env.clipboard.writeText(text);

        // Try to paste
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            await vscode.commands.executeCommand('editor.action.clipboardPasteAction');

            // Try to send (this is experimental and may not work)
            try {
                await vscode.commands.executeCommand('workbench.action.chat.submit');
            } catch {
                // If submit command doesn't exist, just notify user
                vscode.window.showInformationMessage('Prompt pasted. Press Enter to send.');
            }
        } else {
            vscode.window.showInformationMessage('Prompt copied. Paste into chat manually.');
        }
    }

    private async startNewThread(resumePrompt: string): Promise<void> {
        // Open new chat
        await vscode.commands.executeCommand('workbench.action.chat.open');

        // Wait for chat to open
        await this.sleep(500);

        // Paste resume prompt
        await vscode.env.clipboard.writeText(resumePrompt);
        await vscode.commands.executeCommand('editor.action.clipboardPasteAction');

        vscode.window.showInformationMessage('New thread started. Send the message to continue.');
    }

    private async waitForCompletion(timeoutMs: number): Promise<void> {
        // Simple timeout-based approach for now
        // In a more sophisticated version, we could poll the server
        // to check if evidence was submitted
        await this.sleep(timeoutMs);

        // TODO: Implement actual completion detection
        // Option 1: Poll server for response-complete status
        // Option 2: Watch for completion marker in chat (harder)
        // Option 3: Just use timeout (current approach)
    }

    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    private cleanup(): void {
        this.isRunning = false;
        this.currentJobId = null;
        this.abortController = null;
        this.statusBarItem.hide();
    }

    dispose(): void {
        this.stop();
        this.statusBarItem.dispose();
    }
}
