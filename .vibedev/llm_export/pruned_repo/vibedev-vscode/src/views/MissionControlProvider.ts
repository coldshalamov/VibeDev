// =============================================================================
// Mission Control Webview Provider - Sidebar UI
// =============================================================================

import * as vscode from 'vscode';
import { VibedDevClient } from '../client/VibedDevClient';
import { AutopromptEngine } from '../autoprompt/AutopromptEngine';

export class MissionControlProvider implements vscode.WebviewViewProvider {
    private view?: vscode.WebviewView;

    constructor(
        private readonly extensionUri: vscode.Uri,
        private client: VibedDevClient,
        private autopromptEngine: AutopromptEngine
    ) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        token: vscode.CancellationToken
    ) {
        this.view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.extensionUri]
        };

        webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

        // Handle messages from webview
        webviewView.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'nextStep':
                    await vscode.commands.executeCommand('vibedev.nextStep');
                    break;
                case 'startAutoprompt':
                    await vscode.commands.executeCommand('vibedev.startAutoprompt');
                    break;
                case 'stopAutoprompt':
                    await vscode.commands.executeCommand('vibedev.stopAutoprompt');
                    break;
                case 'openDashboard':
                    await vscode.commands.executeCommand('vibedev.openDashboard');
                    break;
                case 'refresh':
                    await this.updateJobStatus();
                    break;
            }
        });

        // Initial update
        this.updateJobStatus();

        // Poll for updates every 5 seconds
        setInterval(() => {
            this.updateJobStatus();
        }, 5000);
    }

    private async updateJobStatus() {
        if (!this.view) return;

        try {
            const jobId = await this.client.getCurrentJobId();

            if (!jobId) {
                this.view.webview.postMessage({
                    type: 'jobStatus',
                    data: null
                });
                return;
            }

            const status = await this.client.getJobStatus(jobId);
            this.view.webview.postMessage({
                type: 'jobStatus',
                data: status
            });

            // Get UI state for more details
            const uiState = await this.client.getUIState(jobId);
            this.view.webview.postMessage({
                type: 'uiState',
                data: uiState
            });

        } catch (error) {
            console.error('Failed to update job status:', error);
        }
    }

    private getHtmlForWebview(webview: vscode.Webview): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>VibeDev Mission Control</title>
    <style>
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background: var(--vscode-sideBar-background);
            padding: 16px;
        }

        .header {
            margin-bottom: 20px;
            padding-bottom: 12px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }

        .header h1 {
            font-size: 18px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .pulse-dot {
            width: 8px;
            height: 8px;
            background: var(--vscode-terminal-ansiGreen);
            border-radius: 50%;
            animation: pulse 2s infinite;
        }

        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }

        .status-card {
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            padding: 12px;
            margin-bottom: 12px;
        }

        .status-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
            font-size: 13px;
        }

        .status-label {
            color: var(--vscode-descriptionForeground);
        }

        .status-value {
            font-weight: 500;
            font-family: var(--vscode-editor-font-family);
        }

        .progress-bar {
            height: 6px;
            background: var(--vscode-progressBar-background);
            border-radius: 3px;
            overflow: hidden;
            margin-top: 8px;
        }

        .progress-fill {
            height: 100%;
            background: var(--vscode-terminal-ansiGreen);
            transition: width 0.3s ease;
        }

        .btn {
            width: 100%;
            padding: 10px 16px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 4px;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            margin-bottom: 8px;
            transition: background 0.2s;
        }

        .btn:hover {
            background: var(--vscode-button-hoverBackground);
        }

        .btn-secondary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }

        .btn-secondary:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }

        .btn-danger {
            background: var(--vscode-inputValidation-errorBackground);
            color: var(--vscode-inputValidation-errorForeground);
        }

        .empty-state {
            text-align: center;
            padding: 32px 16px;
            color: var(--vscode-descriptionForeground);
        }

        .empty-state-icon {
            font-size: 48px;
            margin-bottom: 12px;
            opacity: 0.5;
        }

        .step-list {
            max-height: 300px;
            overflow-y: auto;
            margin-top: 12px;
        }

        .step-item {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px;
            border-radius: 4px;
            margin-bottom: 4px;
            font-size: 12px;
        }

        .step-item.active {
            background: var(--vscode-list-activeSelectionBackground);
            color: var(--vscode-list-activeSelectionForeground);
        }

        .step-item.done {
            opacity: 0.6;
        }

        .step-icon {
            font-size: 14px;
        }

        .divider {
            height: 1px;
            background: var(--vscode-panel-border);
            margin: 16px 0;
        }

        .offline {
            color: var(--vscode-inputValidation-errorForeground);
            text-align: center;
            padding: 12px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>
            <span class="pulse-dot"></span>
            Mission Control
        </h1>
    </div>

    <div id="content">
        <div class="empty-state">
            <div class="empty-state-icon">🔄</div>
            <p>Loading...</p>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        let currentJobStatus = null;
        let currentUIState = null;

        // Listen for messages from extension
        window.addEventListener('message', event => {
            const message = event.data;

            if (message.type === 'jobStatus') {
                currentJobStatus = message.data;
                render();
            } else if (message.type === 'uiState') {
                currentUIState = message.data;
                render();
            }
        });

        function render() {
            const content = document.getElementById('content');

            if (!currentJobStatus) {
                content.innerHTML = \`
                    <div class="empty-state">
                        <div class="empty-state-icon">🎯</div>
                        <p style="margin-bottom: 16px;">No active mission</p>
                        <button class="btn" onclick="openDashboard()">
                            Open Web Dashboard
                        </button>
                    </div>
                \`;
                return;
            }

            const progress = ((currentJobStatus.current_step_index + 1) / currentJobStatus.total_steps) * 100;

            content.innerHTML = \`
                <div class="status-card">
                    <div class="status-row">
                        <span class="status-label">Job</span>
                        <span class="status-value">\${currentJobStatus.title || currentJobStatus.job_id}</span>
                    </div>
                    <div class="status-row">
                        <span class="status-label">Status</span>
                        <span class="status-value">\${getStatusBadge(currentJobStatus.status)}</span>
                    </div>
                    <div class="status-row">
                        <span class="status-label">Progress</span>
                        <span class="status-value">\${currentJobStatus.current_step_index + 1}/\${currentJobStatus.total_steps}</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: \${progress}%"></div>
                    </div>
                </div>

                \${currentJobStatus.current_step_title ? \`
                    <div class="status-card">
                        <div class="status-label" style="margin-bottom: 4px;">Current Step</div>
                        <div class="status-value">\${currentJobStatus.current_step_title}</div>
                    </div>
                \` : ''}

                <div class="divider"></div>

                <button class="btn" onclick="nextStep()">
                    ▶️ Next Step
                </button>

                <button class="btn btn-secondary" onclick="startAutoprompt()">
                    🚀 Start Autoprompt
                </button>

                <button class="btn btn-secondary" onclick="openDashboard()">
                    🌐 Open Dashboard
                </button>

                \${renderSteps()}
            \`;
        }

        function renderSteps() {
            if (!currentUIState || !currentUIState.steps) {
                return '';
            }

            const stepsHtml = currentUIState.steps.map((step, index) => {
                const isCurrent = currentJobStatus && index === currentJobStatus.current_step_index;
                const isDone = step.status === 'DONE';
                const icon = isDone ? '✅' : (isCurrent ? '⏳' : '⭕');
                const className = isCurrent ? 'active' : (isDone ? 'done' : '');

                return \`
                    <div class="step-item \${className}">
                        <span class="step-icon">\${icon}</span>
                        <span>\${index + 1}. \${step.title}</span>
                    </div>
                \`;
            }).join('');

            return \`
                <div class="divider"></div>
                <div style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 8px;">
                    Steps
                </div>
                <div class="step-list">
                    \${stepsHtml}
                </div>
            \`;
        }

        function getStatusBadge(status) {
            const badges = {
                'PLANNING': '💡 Planning',
                'READY': '✅ Ready',
                'EXECUTING': '⚡ Executing',
                'PAUSED': '⏸️ Paused',
                'COMPLETE': '🎉 Complete',
                'FAILED': '❌ Failed',
                'ARCHIVED': '📦 Archived'
            };
            return badges[status] || status;
        }

        function nextStep() {
            vscode.postMessage({ command: 'nextStep' });
        }

        function startAutoprompt() {
            vscode.postMessage({ command: 'startAutoprompt' });
        }

        function stopAutoprompt() {
            vscode.postMessage({ command: 'stopAutoprompt' });
        }

        function openDashboard() {
            vscode.postMessage({ command: 'openDashboard' });
        }

        function refresh() {
            vscode.postMessage({ command: 'refresh' });
        }

        // Initial render
        render();
    </script>
</body>
</html>`;
    }
}
