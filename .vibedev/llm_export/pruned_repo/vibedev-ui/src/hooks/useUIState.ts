// =============================================================================
// React Query Hooks for VibeDev API
// =============================================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '@/lib/api';
import { useVibeDevStore } from '@/stores/useVibeDevStore';

// =============================================================================
// Query Keys
// =============================================================================

export const queryKeys = {
  jobs: ['jobs'] as const,
  jobsList: (status?: string) => ['jobs', 'list', status] as const,
  job: (jobId: string) => ['jobs', jobId] as const,
  uiState: (jobId: string) => ['jobs', jobId, 'ui-state'] as const,
  questions: (jobId: string) => ['jobs', jobId, 'questions'] as const,
  stepPrompt: (jobId: string) => ['jobs', jobId, 'step-prompt'] as const,       
  devlog: (jobId: string) => ['jobs', jobId, 'devlog'] as const,
  gitStatus: (jobId: string) => ['jobs', jobId, 'git', 'status'] as const,      
  gitLog: (jobId: string) => ['jobs', jobId, 'git', 'log'] as const,
  repoHygiene: (jobId: string) => ['jobs', jobId, 'repo', 'hygiene'] as const,  
  contextSearch: (jobId: string, query: string) =>
    ['jobs', jobId, 'context', 'search', query] as const,
  contextBlock: (jobId: string, contextId: string) =>
    ['jobs', jobId, 'context', 'block', contextId] as const,
};

// =============================================================================
// UI State Hook (Main Data Source)
// =============================================================================

export function useUIState(jobId: string | null) {
  const setUIState = useVibeDevStore((state) => state.setUIState);

  return useQuery({
    queryKey: jobId ? queryKeys.uiState(jobId) : ['noop'],
    queryFn: async () => {
      if (!jobId) return null;
      const state = await api.getUIState(jobId);
      setUIState(state);
      return state;
    },
    enabled: !!jobId,
    refetchInterval: 5000, // Poll every 5 seconds for real-time updates
  });
}

// =============================================================================
// Job List Hook
// =============================================================================

export function useJobsList(status?: string) {
  return useQuery({
    queryKey: queryKeys.jobsList(status),
    queryFn: () => api.listJobs(status),
  });
}

// =============================================================================
// Planning Questions Hook
// =============================================================================

export function useNextQuestions(jobId: string | null) {
  return useQuery({
    queryKey: jobId ? queryKeys.questions(jobId) : ['noop'],
    queryFn: async () => {
      if (!jobId) return { questions: [] };
      return api.getNextQuestions(jobId);
    },
    enabled: !!jobId,
  });
}

// =============================================================================
// Devlog Hook
// =============================================================================

export function useDevlog(jobId: string | null, logType?: string) {
  return useQuery({
    queryKey: jobId ? [...queryKeys.devlog(jobId), logType] : ['noop'],
    queryFn: async () => {
      if (!jobId) return { count: 0, entries: [] };
      return api.listDevlogs(jobId, logType);
    },
    enabled: !!jobId,
  });
}

// =============================================================================
// Git Hooks
// =============================================================================

export function useGitStatus(jobId: string | null) {
  return useQuery({
    queryKey: jobId ? queryKeys.gitStatus(jobId) : ['noop'],
    queryFn: async () => {
      if (!jobId) return null;
      return api.getGitStatus(jobId);
    },
    enabled: !!jobId,
    refetchInterval: 30000, // Poll less frequently for git status
  });
}

export function useGitLog(jobId: string | null, n?: number) {
  return useQuery({
    queryKey: jobId ? [...queryKeys.gitLog(jobId), n] : ['noop'],
    queryFn: async () => {
      if (!jobId) return null;
      return api.getGitLog(jobId, n);
    },
    enabled: !!jobId,
  });
}

// =============================================================================
// Repo Hygiene Hook
// =============================================================================

export function useRepoHygiene(jobId: string | null) {
  return useQuery({
    queryKey: jobId ? queryKeys.repoHygiene(jobId) : ['noop'],
    queryFn: async () => {
      if (!jobId) return null;
      return api.getRepoHygiene(jobId);
    },
    enabled: !!jobId,
    staleTime: 60000, // Cache for 1 minute
  });
}

// =============================================================================
// Context Blocks (Research / Prompt Engineering)
// =============================================================================

export function useContextSearch(jobId: string | null, query: string) {
  return useQuery({
    queryKey: jobId ? queryKeys.contextSearch(jobId, query) : ['noop'],
    queryFn: async () => {
      if (!jobId) return { results: [] };
      return api.searchContext(jobId, query, 100);
    },
    enabled: !!jobId,
    refetchInterval: 4000,
  });
}

export function useContextBlock(jobId: string | null, contextId: string | null) {
  return useQuery({
    queryKey: jobId && contextId ? queryKeys.contextBlock(jobId, contextId) : ['noop'],
    queryFn: async () => {
      if (!jobId || !contextId) return null;
      return api.getContextBlock(jobId, contextId);
    },
    enabled: !!jobId && !!contextId,
  });
}

export function useAddContextBlock(jobId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { blockType: string; content: string; tags: string[] }) =>
      api.addContextBlock(jobId, payload.blockType, payload.content, payload.tags),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs', jobId, 'context'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.uiState(jobId) });
    },
  });
}

export function useUpdateContextBlock(jobId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      contextId: string;
      patch: { block_type?: string; content?: string; tags?: string[] };
    }) => api.updateContextBlock(jobId, payload.contextId, payload.patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs', jobId, 'context'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.uiState(jobId) });
    },
  });
}

export function useDeleteContextBlock(jobId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (contextId: string) => api.deleteContextBlock(jobId, contextId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs', jobId, 'context'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.uiState(jobId) });
    },
  });
}

// =============================================================================
// Step Prompt Hook (Execution)
// =============================================================================

export function useStepPrompt(jobId: string | null, stepId: string | null) {
  return useQuery({
    queryKey: jobId ? [...queryKeys.stepPrompt(jobId), stepId] : ['noop'],
    queryFn: async () => {
      if (!jobId) return null;
      return api.getNextStepPrompt(jobId);
    },
    enabled: !!jobId && !!stepId,
  });
}

// =============================================================================
// Mutation Hooks
// =============================================================================

export function useCreateJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      title,
      goal,
      repoRoot,
      policies,
    }: {
      title: string;
      goal: string;
      repoRoot?: string;
      policies?: Record<string, unknown>;
    }) => api.createJob(title, goal, repoRoot, policies),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs });
    },
  });
}

export function useAnswerQuestions(jobId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (answers: Record<string, unknown>) =>
      api.answerQuestions(jobId, answers),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.uiState(jobId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.questions(jobId) });
    },
  });
}

export function useSetDeliverables(jobId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (deliverables: string[]) =>
      api.setDeliverables(jobId, deliverables),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.uiState(jobId) });
    },
  });
}

export function useSetInvariants(jobId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (invariants: string[]) => api.setInvariants(jobId, invariants),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.uiState(jobId) });
    },
  });
}

export function useSetDefinitionOfDone(jobId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dod: string[]) => api.setDefinitionOfDone(jobId, dod),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.uiState(jobId) });
    },
  });
}

export function useProposeSteps(jobId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (
      steps: Array<{
        step_id?: string;
        title: string;
        instruction_prompt: string;
        acceptance_criteria?: string[];
        required_evidence?: string[];
      }>
    ) => api.proposeSteps(jobId, steps),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.uiState(jobId) });
    },
  });
}

export function useRefineSteps(jobId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (
      edits: Array<{
        step_id: string;
        action: 'update' | 'insert_before' | 'insert_after' | 'delete';
        data?: Record<string, unknown>;
      }>
    ) => api.refineSteps(jobId, edits),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.uiState(jobId) });    
    },
  });
}

export function useApplyTemplate(jobId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      templateId,
      overwritePlanningArtifacts,
      overwriteSteps,
    }: {
      templateId: string;
      overwritePlanningArtifacts?: boolean;
      overwriteSteps?: boolean;
    }) =>
      api.applyTemplate(jobId, templateId, {
        overwrite_planning_artifacts: overwritePlanningArtifacts,
        overwrite_steps: overwriteSteps,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.uiState(jobId) });
    },
  });
}

export function useUpdateJobPolicies(jobId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { update: Record<string, unknown>; merge?: boolean }) =>
      api.updateJobPolicies(jobId, payload.update, payload.merge ?? true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.uiState(jobId) });
    },
  });
}

export function useSetJobReady(jobId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.setJobReady(jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.uiState(jobId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs });
    },
  });
}

export function useStartJob(jobId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.startJob(jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.uiState(jobId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs });
    },
  });
}

export function usePauseJob(jobId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.pauseJob(jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.uiState(jobId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs });
    },
  });
}

export function useResumeJob(jobId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.resumeJob(jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.uiState(jobId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs });
    },
  });
}

export function useFailJob(jobId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (reason: string) => api.failJob(jobId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.uiState(jobId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs });
    },
  });
}

export function useArchiveJob(jobId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.archiveJob(jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.uiState(jobId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs });
    },
  });
}

export function useSubmitStepResult(jobId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      stepId,
      modelClaim,
      summary,
      evidence,
      devlogLine,
      commitHash,
    }: {
      stepId: string;
      modelClaim: 'MET' | 'NOT_MET' | 'PARTIAL';
      summary: string;
      evidence: Record<string, unknown>;
      devlogLine?: string;
      commitHash?: string;
    }) =>
      api.submitStepResult(
        jobId,
        stepId,
        modelClaim,
        summary,
        evidence,
        devlogLine,
        commitHash
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.uiState(jobId) });
    },
  });
}

export function useAppendDevlog(jobId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ content, stepId }: { content: string; stepId?: string }) =>
      api.appendDevlog(jobId, content, stepId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.devlog(jobId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.uiState(jobId) });
    },
  });
}

export function useRecordMistake(jobId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      title,
      whatHappened,
      why,
      lesson,
      avoidNextTime,
      tags,
      relatedStepId,
    }: {
      title: string;
      whatHappened: string;
      why: string;
      lesson: string;
      avoidNextTime: string;
      tags: string[];
      relatedStepId?: string;
    }) =>
      api.recordMistake(
        jobId,
        title,
        whatHappened,
        why,
        lesson,
        avoidNextTime,
        tags,
        relatedStepId
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.uiState(jobId) });
    },
  });
}

export function useCreateRepoSnapshot(jobId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notes?: string) => api.createRepoSnapshot(jobId, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.uiState(jobId) });
    },
  });
}

export function useExportJob(jobId: string) {
  return useMutation({
    mutationFn: (format: 'json' | 'md') => api.exportJob(jobId, format),
  });
}
