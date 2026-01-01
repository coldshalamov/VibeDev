// =============================================================================
// VibeDev UI Types
// =============================================================================

export type JobStatus =
  | 'PLANNING'
  | 'READY'
  | 'EXECUTING'
  | 'PAUSED'
  | 'COMPLETE'
  | 'FAILED'
  | 'ARCHIVED';

export type StepStatus = 'PENDING' | 'ACTIVE' | 'DONE' | 'SKIPPED';

export type ModelClaim = 'MET' | 'NOT_MET' | 'PARTIAL';

export interface Policies {
  require_devlog_per_step?: boolean;
  require_commit_per_step?: boolean;
  allow_batch_commits?: boolean;
  require_tests_evidence?: boolean;
  require_diff_summary?: boolean;
  inject_invariants_every_step?: boolean;
  inject_mistakes_every_step?: boolean;
  evidence_schema_mode?: 'loose' | 'strict';
  max_retries_per_step?: number;
  retry_exhausted_action?: 'PAUSE_FOR_HUMAN' | 'FAIL_JOB';
}

export interface Job {
  job_id: string;
  title: string;
  goal: string;
  status: JobStatus;
  created_at: string;
  updated_at: string;
  repo_root: string | null;
  policies: Policies;
  deliverables: string[];
  invariants: string[];
  definition_of_done: string[];
  current_step_index: number;
  total_steps: number;
  failure_reason?: string | null;
}

export interface Step {
  job_id: string;
  step_id: string;
  order_index: number;
  title: string;
  instruction_prompt: string;
  expected_outputs: string[];
  acceptance_criteria: string[];
  required_evidence: string[];
  gates?: Array<{
    type: string;
    parameters?: Record<string, unknown>;
    description?: string;
  }>;
  remediation_prompt: string;
  context_refs: string[];
  status: StepStatus;
  attempt_count: number;
}

export interface Evidence {
  changed_files?: string[];
  diff_summary?: string;
  commands_run?: string[];
  tests_run?: string[];
  tests_passed?: boolean;
  lint_run?: boolean;
  lint_passed?: boolean;
  artifacts_created?: string[];
  criteria_checklist?: Record<string, boolean>;
  notes?: string;
  devlog_line?: string;
  commit_hash?: string;
}

export interface Attempt {
  attempt_id: string;
  job_id: string;
  step_id: string;
  timestamp: string;
  model_claim: ModelClaim;
  summary: string;
  evidence: Evidence;
  outcome: 'accepted' | 'rejected';
  rejection_reasons: string[];
  missing_fields: string[];
  devlog_line: string | null;
  commit_hash: string | null;
}

export interface Mistake {
  mistake_id: string;
  title: string;
  lesson: string;
  avoid_next_time: string;
  tags: string[];
  created_at: string;
  related_step_id: string | null;
}

export interface LogEntry {
  log_id: string;
  log_type: string;
  content: string;
  created_at: string;
  step_id: string | null;
  commit_hash: string | null;
}

export interface RepoMapEntry {
  path: string;
  description: string;
  updated_at: string;
}

export interface GitStatus {
  ok: boolean;
  error?: string;
  clean?: boolean;
  modified?: string[];
  added?: string[];
  deleted?: string[];
  raw?: string;
}

export interface PhaseInfo {
  current_phase: number;
  current_phase_name: string;
  is_complete: boolean;
  phases: Record<string, { phase: number; complete: boolean; current: boolean }>;
  has_repo: boolean;
  step_count: number;
}

export interface PlanningQuestion {
  phase: number;
  key: string;
  question: string;
  rationale: string;
  required_fields: string[];
  required: boolean;
}

export interface UIState {
  job: Job;
  phase: PhaseInfo;
  steps: Step[];
  current_step: Step | null;
  current_step_attempts: Attempt[];
  mistakes: Mistake[];
  recent_logs: LogEntry[];
  repo_map: RepoMapEntry[];
  git_status: GitStatus | null;
  context_block_count: number;
  planning_answers: Record<string, unknown>;
}

// =============================================================================
// API Response Types
// =============================================================================

export interface JobListItem {
  job_id: string;
  title: string;
  goal: string;
  status: JobStatus;
  created_at: string;
  updated_at: string;
  step_count: number;
  current_step_index: number;
}

export interface JobListResponse {
  count: number;
  jobs: JobListItem[];
}

export interface SubmitResult {
  accepted: boolean;
  feedback: string;
  next_action:
    | 'RETRY'
    | 'NEXT_STEP_AVAILABLE'
    | 'JOB_COMPLETE'
    | 'PAUSE_FOR_HUMAN'
    | 'FAIL_JOB';
  missing_fields: string[];
  rejection_reasons: string[];
}

export interface StepPrompt {
  step_id: string;
  prompt: string;
  acceptance_criteria: string[];
  required_evidence: { required: string[] };
  invariants: string[];
  relevant_mistakes: string[];
  required_evidence_template: Record<string, unknown>;
}
