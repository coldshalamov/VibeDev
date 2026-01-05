// =============================================================================
// VibeDev API Client
// =============================================================================

import type {
  UIState,
  JobListResponse,
  StepPrompt,
  SubmitResult,
  PlanningQuestion,
} from '@/types';
import type { paths } from '@/generated/openapi';

export type TemplateSummary = {
  template_id: string;
  title: string;
  description: string;
};

export type ContextBlockSummary = {
  context_id: string;
  block_type: string;
  tags: string[];
  created_at: string;
  excerpt: string;
};

export type ContextBlock = {
  context_id: string;
  job_id: string;
  block_type: string;
  content: string;
  tags: string[];
  created_at: string;
};

type HealthResponse =
  paths['/api/health']['get']['responses']['200']['content']['application/json'];

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL ?? '';
const API_PREFIX = (import.meta as any).env?.VITE_API_PREFIX ?? '/api';
const API_BASE = `${API_BASE_URL}${API_PREFIX}`;

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new ApiError(response.status, error);
  }

  return response.json();
}

export async function getHealth(): Promise<HealthResponse> {
  return request(`/health`);
}

// =============================================================================
// Job Operations
// =============================================================================

export async function listJobs(status?: string): Promise<JobListResponse> {
  const params = status ? `?status=${status}` : '';
  return request(`/jobs${params}`);
}

export async function getUIState(jobId: string): Promise<UIState> {
  return request(`/jobs/${jobId}/ui-state`);
}

export async function saveUIState(
  jobId: string,
  graphState: unknown
): Promise<{ ok: boolean }> {
  return request(`/jobs/${jobId}/ui-state`, {
    method: 'POST',
    body: JSON.stringify({ graph_state: graphState }),
  });
}

export async function createJob(
  title: string,
  goal: string,
  repoRoot?: string,
  policies?: Record<string, unknown>
): Promise<{ job_id: string; questions: PlanningQuestion[] }> {
  return request('/jobs', {
    method: 'POST',
    body: JSON.stringify({ title, goal, repo_root: repoRoot, policies }),       
  });
}

export async function updateJobPolicies(
  jobId: string,
  update: Record<string, unknown>,
  merge: boolean = true
): Promise<{ ok: boolean; job: unknown }> {
  return request(`/jobs/${jobId}/policies`, {
    method: 'PATCH',
    body: JSON.stringify({ update, merge }),
  });
}

export async function archiveJob(jobId: string): Promise<{ ok: boolean }> {     
  return request(`/jobs/${jobId}/archive`, { method: 'POST' });
}

// =============================================================================
// Templates
// =============================================================================

export async function listTemplates(): Promise<{
  count: number;
  templates: TemplateSummary[];
}> {
  return request(`/templates`);
}

export async function applyTemplate(
  jobId: string,
  templateId: string,
  opts?: { overwrite_planning_artifacts?: boolean; overwrite_steps?: boolean }
): Promise<{ ok: boolean; job: unknown; steps: unknown[] }> {
  return request(`/jobs/${jobId}/templates/${templateId}/apply`, {
    method: 'POST',
    body: JSON.stringify({
      overwrite_planning_artifacts: opts?.overwrite_planning_artifacts ?? false,
      overwrite_steps: opts?.overwrite_steps ?? true,
    }),
  });
}

// =============================================================================
// Job Lifecycle
// =============================================================================

export async function pauseJob(jobId: string): Promise<{ ok: boolean; status: string }> {
  return request(`/jobs/${jobId}/pause`, { method: 'POST' });
}

export async function resumeJob(jobId: string): Promise<{ ok: boolean; status: string }> {
  return request(`/jobs/${jobId}/resume`, { method: 'POST' });
}

export async function failJob(
  jobId: string,
  reason: string
): Promise<{ ok: boolean; status: string }> {
  return request(`/jobs/${jobId}/fail`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function startJob(jobId: string): Promise<{ ok: boolean }> {
  return request(`/jobs/${jobId}/start`, { method: 'POST' });
}

export async function setJobReady(
  jobId: string
): Promise<{ ready: boolean; missing: string[] }> {
  return request(`/jobs/${jobId}/ready`, { method: 'POST' });
}

export async function compileUnifiedWorkflow(jobId: string): Promise<{
  ok: boolean;
  job_id: string;
  step_count: number;
  step_order: string[];
}> {
  return request(`/jobs/${jobId}/workflow/compile`, { method: 'POST' });
}

// =============================================================================
// Planning Operations
// =============================================================================

export async function getNextQuestions(
  jobId: string
): Promise<{ questions: PlanningQuestion[] }> {
  return request(`/jobs/${jobId}/questions`);
}

export async function answerQuestions(
  jobId: string,
  answers: Record<string, unknown>
): Promise<{ ok: boolean; questions: PlanningQuestion[] }> {
  return request(`/jobs/${jobId}/questions`, {
    method: 'POST',
    body: JSON.stringify({ answers }),
  });
}

export async function setDeliverables(
  jobId: string,
  deliverables: string[]
): Promise<void> {
  return request(`/jobs/${jobId}/deliverables`, {
    method: 'POST',
    body: JSON.stringify({ deliverables }),
  });
}

export async function setInvariants(
  jobId: string,
  invariants: string[]
): Promise<void> {
  return request(`/jobs/${jobId}/invariants`, {
    method: 'POST',
    body: JSON.stringify({ invariants }),
  });
}

export async function setDefinitionOfDone(
  jobId: string,
  definitionOfDone: string[]
): Promise<void> {
  return request(`/jobs/${jobId}/definition-of-done`, {
    method: 'POST',
    body: JSON.stringify({ definition_of_done: definitionOfDone }),
  });
}

export async function proposeSteps(
  jobId: string,
  steps: Array<{
    step_id?: string;
    title: string;
    instruction_prompt: string;
    acceptance_criteria?: string[];
    required_evidence?: string[];
  }>
): Promise<{ steps: unknown[] }> {
  return request(`/jobs/${jobId}/steps`, {
    method: 'POST',
    body: JSON.stringify({ steps }),
  });
}

export async function refineSteps(
  jobId: string,
  edits: Array<{
    step_id: string;
    action: 'update' | 'insert_before' | 'insert_after' | 'delete';
    data?: Record<string, unknown>;
  }>
): Promise<{ ok: boolean; steps: unknown[] }> {
  return request(`/jobs/${jobId}/steps`, {
    method: 'PATCH',
    body: JSON.stringify({ edits }),
  });
}

// =============================================================================
// Execution Operations
// =============================================================================

export async function getNextStepPrompt(jobId: string): Promise<StepPrompt> {
  return request(`/jobs/${jobId}/step-prompt`);
}

export async function submitStepResult(
  jobId: string,
  stepId: string,
  modelClaim: 'MET' | 'NOT_MET' | 'PARTIAL',
  summary: string,
  evidence: Record<string, unknown>,
  devlogLine?: string,
  commitHash?: string
): Promise<SubmitResult> {
  return request(`/jobs/${jobId}/steps/${stepId}/submit`, {
    method: 'POST',
    body: JSON.stringify({
      model_claim: modelClaim,
      summary,
      evidence,
      devlog_line: devlogLine,
      commit_hash: commitHash,
    }),
  });
}

// =============================================================================
// Context Operations
// =============================================================================

export async function addContextBlock(
  jobId: string,
  blockType: string,
  content: string,
  tags: string[]
): Promise<{ context_id: string }> {
  return request(`/jobs/${jobId}/context`, {
    method: 'POST',
    body: JSON.stringify({ block_type: blockType, content, tags }),
  });
}

export async function searchContext(
  jobId: string,
  query: string,
  limit: number = 100
): Promise<{ results: ContextBlockSummary[] }> {
  return request(
    `/jobs/${jobId}/context/search?q=${encodeURIComponent(query)}&limit=${encodeURIComponent(String(limit))}`
  );
}

export async function getContextBlock(
  jobId: string,
  contextId: string
): Promise<ContextBlock> {
  return request(`/jobs/${jobId}/context/${contextId}`);
}

export async function updateContextBlock(
  jobId: string,
  contextId: string,
  patch: { block_type?: string; content?: string; tags?: string[] }
): Promise<{ ok: boolean; block: ContextBlock }> {
  return request(`/jobs/${jobId}/context/${contextId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function deleteContextBlock(
  jobId: string,
  contextId: string
): Promise<{ ok: boolean }> {
  return request(`/jobs/${jobId}/context/${contextId}`, { method: 'DELETE' });
}

// =============================================================================
// Devlog Operations
// =============================================================================

export async function appendDevlog(
  jobId: string,
  content: string,
  stepId?: string
): Promise<{ log_id: string }> {
  return request(`/jobs/${jobId}/devlog`, {
    method: 'POST',
    body: JSON.stringify({ content, step_id: stepId }),
  });
}

export async function listDevlogs(
  jobId: string,
  logType?: string
): Promise<{ count: number; entries: unknown[] }> {
  const params = logType ? `?log_type=${logType}` : '';
  return request(`/jobs/${jobId}/devlog${params}`);
}

// =============================================================================
// Mistake Operations
// =============================================================================

export async function recordMistake(
  jobId: string,
  title: string,
  whatHappened: string,
  why: string,
  lesson: string,
  avoidNextTime: string,
  tags: string[],
  relatedStepId?: string
): Promise<{ mistake_id: string }> {
  return request(`/jobs/${jobId}/mistakes`, {
    method: 'POST',
    body: JSON.stringify({
      title,
      what_happened: whatHappened,
      why,
      lesson,
      avoid_next_time: avoidNextTime,
      tags,
      related_step_id: relatedStepId,
    }),
  });
}

// =============================================================================
// Git Operations
// =============================================================================

export async function getGitStatus(jobId: string): Promise<{
  ok: boolean;
  clean?: boolean;
  modified?: string[];
  added?: string[];
  deleted?: string[];
}> {
  return request(`/jobs/${jobId}/git/status`);
}

export async function getGitDiff(
  jobId: string,
  staged?: boolean
): Promise<{ ok: boolean; summary: string }> {
  const params = staged ? '?staged=true' : '';
  return request(`/jobs/${jobId}/git/diff${params}`);
}

export async function getGitLog(
  jobId: string,
  n?: number
): Promise<{ ok: boolean; commits: Array<{ hash: string; message: string }> }> {
  const params = n ? `?n=${n}` : '';
  return request(`/jobs/${jobId}/git/log${params}`);
}

// =============================================================================
// Repo Operations
// =============================================================================

export async function getRepoHygiene(
  jobId: string
): Promise<{ count: number; suggestions: Array<{ type: string; path: string; suggestion: string }> }> {
  return request(`/jobs/${jobId}/repo/hygiene`);
}

export async function createRepoSnapshot(
  jobId: string,
  notes?: string
): Promise<{ snapshot_id: string }> {
  return request(`/jobs/${jobId}/repo/snapshot`, {
    method: 'POST',
    body: JSON.stringify({ notes }),
  });
}

// =============================================================================
// Export Operations
// =============================================================================

export async function exportJob(
  jobId: string,
  format: 'json' | 'md' = 'md'
): Promise<{ format: 'json' | 'md'; content?: string; job?: unknown; steps?: unknown[] }> {
  return request(`/jobs/${jobId}/export?format=${format}`);
}
