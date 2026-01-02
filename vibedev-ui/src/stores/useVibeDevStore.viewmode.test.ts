import { beforeEach, describe, expect, it } from 'vitest';
import { useVibeDevStore } from './useVibeDevStore';

function makeUIState(jobId: string, status: any) {
  return {
    job: {
      job_id: jobId,
      title: 'Test Job',
      goal: 'Test',
      status,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      repo_root: null,
      policies: {},
      deliverables: [],
      invariants: [],
      definition_of_done: [],
      current_step_index: 0,
      total_steps: 0,
      failure_reason: null,
    },
    phase: {
      current_phase: 1,
      current_phase_name: 'Phase 1',
      is_complete: false,
      phases: {},
      has_repo: false,
      step_count: 0,
    },
    steps: [],
    current_step: null,
    current_step_attempts: [],
    mistakes: [],
    recent_logs: [],
    repo_map: [],
    git_status: null,
    context_block_count: 0,
    planning_answers: {},
  };
}

describe('useVibeDevStore viewMode auto-switch', () => {
  beforeEach(() => {
    const s = useVibeDevStore.getState();
    s.setUIState(null);
    s.setViewMode('planning');
  });

  it('defaults to planning for a newly selected PLANNING job', () => {
    const s = useVibeDevStore.getState();
    s.setViewMode('research');

    s.setUIState(makeUIState('JOB_1', 'PLANNING'));
    expect(useVibeDevStore.getState().viewMode.mode).toBe('planning');
  });

  it('does not override user-selected view mode on UI state refresh', () => {
    const s = useVibeDevStore.getState();

    // Initial load (job selected): planning is a sensible default.
    s.setUIState(makeUIState('JOB_1', 'PLANNING'));
    expect(useVibeDevStore.getState().viewMode.mode).toBe('planning');

    // User switches tabs away from planning.
    s.setViewMode('research');
    expect(useVibeDevStore.getState().viewMode.mode).toBe('research');

    // UI state refresh (same job, same status) should not snap back.
    s.setUIState(makeUIState('JOB_1', 'PLANNING'));
    expect(useVibeDevStore.getState().viewMode.mode).toBe('research');
  });

  it('auto-advances planning -> execution when job status transitions', () => {
    const s = useVibeDevStore.getState();

    s.setUIState(makeUIState('JOB_1', 'PLANNING'));
    expect(useVibeDevStore.getState().viewMode.mode).toBe('planning');

    s.setUIState(makeUIState('JOB_1', 'READY'));
    expect(useVibeDevStore.getState().viewMode.mode).toBe('execution');
  });
});

