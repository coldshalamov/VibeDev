// =============================================================================
// Status Bar Controller - Shows job status in VS Code status bar
// =============================================================================

import * as vscode from 'vscode';
import { VibedDevClient } from '../client/VibedDevClient';

export class StatusBarController {
    private statusBarItem: vscode.StatusBarItem;
    private pollInterval: NodeJS.Timeout | null = null;

    constructor(private client: VibedDevClient) {
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            99
        );
        this.statusBarItem.command = 'vibedev.openDashboard';
        this.statusBarItem.show();
    }

    startPolling(intervalMs: number = 5000): void {
        this.refresh();

        if (this.pollInterval) {
            clearInterval(this.pollInterval);
        }

        this.pollInterval = setInterval(() => {
            this.refresh();
        }, intervalMs);
    }

    async refresh(): Promise<void> {
        try {
            // Check if server is reachable
            const reachable = await this.client.isServerReachable();

            if (!reachable) {
                this.statusBarItem.text = '$(x) VibeDev Offline';
                this.statusBarItem.tooltip = 'VibeDev server not reachable. Click to open dashboard.';
                this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
                return;
            }

            // Get current job
            const jobId = await this.client.getCurrentJobId();

            if (!jobId) {
                this.statusBarItem.text = '$(circle-outline) VibeDev';
                this.statusBarItem.tooltip = 'No active job. Click to open dashboard.';
                this.statusBarItem.backgroundColor = undefined;
                return;
            }

            // Get job status
            const status = await this.client.getJobStatus(jobId);

            if (!status) {
                this.statusBarItem.text = '$(warning) VibeDev';
                this.statusBarItem.tooltip = 'Failed to load job status';
                this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
                return;
            }

            // Update based on status
            const icon = this.getStatusIcon(status.status);
            const progress = `${status.current_step_index + 1}/${status.total_steps}`;

            this.statusBarItem.text = `${icon} VibeDev ${progress}`;
            this.statusBarItem.tooltip = `${status.title}\nStep: ${status.current_step_title || 'N/A'}\nStatus: ${status.status}`;

            // Set background color based on status
            if (status.status === 'EXECUTING') {
                this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
            } else if (status.status === 'COMPLETE') {
                this.statusBarItem.backgroundColor = undefined;
            } else if (status.status === 'FAILED') {
                this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
            } else {
                this.statusBarItem.backgroundColor = undefined;
            }

        } catch (error) {
            console.error('Status bar refresh error:', error);
            this.statusBarItem.text = '$(alert) VibeDev';
            this.statusBarItem.tooltip = `Error: ${error}`;
        }
    }

    private getStatusIcon(status: string): string {
        switch (status) {
            case 'PLANNING':
                return '$(lightbulb)';
            case 'READY':
                return '$(check)';
            case 'EXECUTING':
                return '$(loading~spin)';
            case 'PAUSED':
                return '$(debug-pause)';
            case 'COMPLETE':
                return '$(pass)';
            case 'FAILED':
                return '$(error)';
            case 'ARCHIVED':
                return '$(archive)';
            default:
                return '$(circle-outline)';
        }
    }

    dispose(): void {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
        }
        this.statusBarItem.dispose();
    }
}
