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

        // Set up document change listener for chat idle detection
        this.setupDocumentChangeListener();
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
        if (!this.currentJobId) return;

        // Get configuration
        const config = vscode.workspace.getConfiguration('vibedev.autoprompt');
        const detectionMode = config.get<string>('completionDetection') || 'both';
        const maxWaitTime = config.get<number>('maxWaitTimeMs') || 300000;
        const pollInterval = 2000; // Check every 2 seconds
        const startTime = Date.now();

        console.log('[AutopromptEngine] Waiting for completion with strategy:', detectionMode);

        let mcpComplete = false;
        let chatComplete = false;
        let consecutiveChatIdleChecks = 0;
        const requiredConsecutiveIdleChecks = 3; // Need 3 consecutive idle checks (6 seconds total)

        while (Date.now() - startTime < maxWaitTime) {
            // Check if aborted
            if (this.abortController?.signal.aborted) {
                console.log('[AutopromptEngine] Aborted during wait');
                return;
            }

            // Method 1: Check MCP server
            if (detectionMode === 'both' || detectionMode === 'mcp-only') {
                try {
                    mcpComplete = await this.client.checkResponseComplete(this.currentJobId);
                } catch (error) {
                    console.warn('[AutopromptEngine] MCP check failed:', error);
                }
            }

            // Method 2: Check VSCode chat state
            if (detectionMode === 'both' || detectionMode === 'chat-only') {
                const isIdle = await this.checkChatIdle();
                if (isIdle) {
                    consecutiveChatIdleChecks++;
                    if (consecutiveChatIdleChecks >= requiredConsecutiveIdleChecks) {
                        chatComplete = true;
                    }
                } else {
                    consecutiveChatIdleChecks = 0;
                    chatComplete = false;
                }
            }

            // Determine if we're complete based on strategy
            let isComplete = false;
            if (detectionMode === 'both') {
                // Both methods must agree (OR logic for redundancy)
                isComplete = mcpComplete || chatComplete;
            } else if (detectionMode === 'mcp-only') {
                isComplete = mcpComplete;
            } else if (detectionMode === 'chat-only') {
                isComplete = chatComplete;
            }

            if (isComplete) {
                // Wait additional buffer time to ensure model fully stopped
                console.log('[AutopromptEngine] Initial completion detected, waiting buffer time...');
                await this.sleep(2000);

                // Double-check conditions one final time
                let finalComplete = false;
                if (detectionMode === 'both' || detectionMode === 'mcp-only') {
                    const finalMcpCheck = await this.client.checkResponseComplete(this.currentJobId);
                    finalComplete = finalMcpCheck;
                }
                if (detectionMode === 'both' || detectionMode === 'chat-only') {
                    const finalChatCheck = await this.checkChatIdle();
                    finalComplete = finalComplete || finalChatCheck;
                }

                if (finalComplete) {
                    const elapsed = Date.now() - startTime;
                    console.log('[AutopromptEngine] Completion confirmed:', {
                        mode: detectionMode,
                        mcp: mcpComplete,
                        chat: chatComplete,
                        elapsed: elapsed
                    });
                    return;
                }

                // False alarm, reset and continue
                console.log('[AutopromptEngine] False alarm, continuing to wait...');
                consecutiveChatIdleChecks = 0;
            }

            // Wait before next poll
            await this.sleep(pollInterval);
        }

        // Timeout reached - warn but continue
        const elapsed = Date.now() - startTime;
        vscode.window.showWarningMessage(`⚠️ Completion detection timeout after ${elapsed}ms. Proceeding anyway.`);
        console.warn('[AutopromptEngine] Completion detection timeout after', elapsed, 'ms');
    }

    private async checkChatIdle(): Promise<boolean> {
        // VSCode doesn't expose direct chat state APIs, so we use heuristics:
        // Monitor document changes as a proxy for "model is still typing"

        try {
            const config = vscode.workspace.getConfiguration('vibedev.autoprompt');
            const idleThreshold = config.get<number>('chatIdleThresholdMs') || 5000;

            const now = Date.now();
            const lastChangeTime = this.lastDocumentChangeTime || 0;
            const timeSinceLastChange = now - lastChangeTime;

            // If no changes in the threshold time, consider chat idle
            const isIdle = timeSinceLastChange >= idleThreshold;

            if (isIdle && timeSinceLastChange < idleThreshold + 10000) {
                // Log only when transitioning to idle (within 10s window)
                console.log(`[AutopromptEngine] Chat idle for ${timeSinceLastChange}ms`);
            }

            return isIdle;
        } catch (error) {
            // If we can't determine chat state, assume not idle
            // (fail-safe: rely on MCP check or timeout)
            console.warn('[AutopromptEngine] Error checking chat idle state:', error);
            return false;
        }
    }

    private lastDocumentChangeTime: number = 0;

    private setupDocumentChangeListener(): void {
        // Listen for document changes to track when the model is actively responding
        // This is our primary signal that Claude is still streaming output

        this.context.subscriptions.push(
            vscode.workspace.onDidChangeTextDocument((event) => {
                // Track ANY document changes while autoprompt is running
                // This catches Claude's responses being streamed into the chat
                if (this.isRunning && event.contentChanges.length > 0) {
                    // Filter out user typing (changes are typically larger when Claude is responding)
                    // or any changes to specific document types
                    const uri = event.document.uri;
                    const isUserFile = uri.scheme === 'file';
                    const hasSubstantialChange = event.contentChanges.some(change =>
                        change.text.length > 10 || change.rangeLength > 10
                    );

                    // Update timestamp if:
                    // 1. It's not a regular file (could be chat/output)
                    // 2. OR it's a substantial change (likely Claude's response)
                    if (!isUserFile || hasSubstantialChange) {
                        const now = Date.now();
                        const timeSinceLast = now - this.lastDocumentChangeTime;

                        // Log frequent updates (likely streaming)
                        if (timeSinceLast < 1000) {
                            console.log('[AutopromptEngine] Detected active streaming');
                        }

                        this.lastDocumentChangeTime = now;
                    }
                }
            })
        );

        // Also monitor file system changes (Claude often creates/modifies files)
        // This catches tool execution that creates artifacts
        this.context.subscriptions.push(
            vscode.workspace.onDidSaveTextDocument((document) => {
                if (this.isRunning) {
                    this.lastDocumentChangeTime = Date.now();
                    console.log('[AutopromptEngine] File save detected:', document.uri.fsPath);
                }
            })
        );

        // Monitor when new files are created (tool outputs, etc.)
        this.context.subscriptions.push(
            vscode.workspace.onDidCreateFiles((event) => {
                if (this.isRunning && event.files.length > 0) {
                    this.lastDocumentChangeTime = Date.now();
                    console.log('[AutopromptEngine] Files created:', event.files.length);
                }
            })
        )
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
