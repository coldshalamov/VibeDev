// =============================================================================
// VibeDev HTTP Client
// =============================================================================

export interface NextPromptResponse {
    action: 'NEXT_STEP' | 'RETRY' | 'DIAGNOSE' | 'NEW_THREAD' | 'JOB_COMPLETE' | 'AWAIT_HUMAN';
    prompt?: string;
    step_id?: string;
    job_id?: string;
    metadata?: any;
}

export interface SubmitEvidenceResponse {
    accepted: boolean;
    feedback?: string;
    next_action?: string;
    next_step_id?: string;
    rejection_reasons?: string[];
}

export interface JobStatus {
    job_id: string;
    status: 'PLANNING' | 'READY' | 'EXECUTING' | 'PAUSED' | 'COMPLETE' | 'FAILED' | 'ARCHIVED';
    title: string;
    current_step_index: number;
    total_steps: number;
    current_step_title?: string;
}

export class VibedDevClient {
    constructor(private baseUrl: string) {}

    async getCurrentJobId(): Promise<string | null> {
        try {
            const response = await fetch(`${this.baseUrl}/api/jobs/current`);
            if (!response.ok) return null;
            const data = await response.json();
            return data.job_id || null;
        } catch (error) {
            console.error('Failed to get current job:', error);
            return null;
        }
    }

    async getJobStatus(jobId: string): Promise<JobStatus | null> {
        try {
            const response = await fetch(`${this.baseUrl}/api/jobs/${jobId}/status`);
            if (!response.ok) return null;
            return await response.json();
        } catch (error) {
            console.error('Failed to get job status:', error);
            return null;
        }
    }

    async getNextPrompt(jobId: string): Promise<NextPromptResponse> {
        const response = await fetch(`${this.baseUrl}/api/jobs/${jobId}/next-prompt-auto`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }
        return await response.json();
    }

    async submitEvidence(jobId: string, evidence: any): Promise<SubmitEvidenceResponse> {
        const response = await fetch(`${this.baseUrl}/api/jobs/${jobId}/submit-evidence`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ evidence })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }

        return await response.json();
    }

    async checkResponseComplete(jobId: string): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseUrl}/api/jobs/${jobId}/response-complete`);
            if (!response.ok) return false;
            const data = await response.json();
            return data.complete === true;
        } catch {
            return false;
        }
    }

    async getUIState(jobId: string): Promise<any> {
        const response = await fetch(`${this.baseUrl}/api/jobs/${jobId}/ui-state`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }
        return await response.json();
    }

    async isServerReachable(): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseUrl}/health`, {
                method: 'GET',
                signal: AbortSignal.timeout(2000)
            });
            return response.ok;
        } catch {
            return false;
        }
    }
}
