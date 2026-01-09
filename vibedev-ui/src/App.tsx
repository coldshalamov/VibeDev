// =============================================================================
// VibeDev Main Application
// =============================================================================

import { useEffect, useState } from 'react';
import { useVibeDevStore, useViewMode, useTheme } from '@/stores/useVibeDevStore';
import { useUIState, useCreateJob } from '@/hooks/useUIState';
import { useJobEvents } from '@/hooks/useJobEvents';
import { InfoSidebar } from '@/components/InfoSidebar';
import { AutomationCockpit } from '@/components/AutomationCockpit';
import { JobSelector } from '@/components/JobSelector';
import { ConnectionStatus } from '@/components/ConnectionStatus';
import { UnifiedWorkflowView } from '@/components/UnifiedWorkflowView';
import { cn } from '@/lib/utils';

function App() {
  const currentJobId = useVibeDevStore((state) => state.currentJobId);
  const sidebar = useVibeDevStore((state) => state.sidebar);
  const viewMode = useViewMode();
  const theme = useTheme();

  // Fetch UI state for current job
  const { isLoading, error } = useUIState(currentJobId);
  useJobEvents(currentJobId);

  // Apply theme
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)')
        .matches
        ? 'dark'
        : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
  }, [theme]);

  // Loading state
  if (isLoading && currentJobId) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-muted-foreground">Loading job state...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-destructive mb-2">Error loading job</p>
          <p className="text-sm text-muted-foreground">{(error as Error).message}</p>
          <div className="mt-4 flex justify-center">
            <ConnectionStatus />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Info Sidebar - Findings, Mistakes, Log */}
      {sidebar.isOpen && (
        <aside className="w-72 flex-shrink-0">
          <InfoSidebar />
        </aside>
      )}

      {/* Main Content Area */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Header with Job Selector and Automation Controls */}
        <header className="flex h-14 items-center justify-between border-b bg-card px-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => useVibeDevStore.getState().toggleSidebar()}
              className="btn btn-ghost btn-icon"
              title={sidebar.isOpen ? 'Hide sidebar' : 'Show sidebar'}
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>

            {/* Back to Home Button (Visible when job is selected) */}
            {currentJobId && (
              <button
                onClick={() => useVibeDevStore.getState().setCurrentJob(null)}
                className="btn btn-ghost btn-icon"
                title="Back to Job List"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
            )}

            <JobSelector />
          </div>

          {/* View Mode Tabs */}
          <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
            <ViewModeTab mode="research" label="Research" />
            <ViewModeTab mode="planning" label="Planning" />
            <ViewModeTab mode="execution" label="Execution" />
            <ViewModeTab mode="review" label="Review" />
          </div>

          <div className="flex items-center gap-3">
            <ConnectionStatus />
            <AutomationCockpit compact />
          </div>
        </header>

        {/* Content based on view mode */}
        <div className="flex-1 overflow-auto">
          {!currentJobId ? (
            <EmptyState />
          ) : viewMode === 'research' ? (
            <UnifiedWorkflowView phase="research" />
          ) : viewMode === 'planning' ? (
            <UnifiedWorkflowView phase="planning" />
          ) : viewMode === 'execution' ? (
            <UnifiedWorkflowView phase="execution" />
          ) : (
            <UnifiedWorkflowView phase="review" />
          )}
        </div>
      </main>
    </div>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

function ViewModeTab({ mode, label }: { mode: 'workflow' | 'research' | 'planning' | 'execution' | 'review'; label: string }) {
  const currentMode = useViewMode();
  const setViewMode = useVibeDevStore((state) => state.setViewMode);

  return (
    <button
      onClick={() => setViewMode(mode)}
      className={cn(
        'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
        currentMode === mode
          ? 'bg-background text-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground'
      )}
    >
      {label}
    </button>
  );
}

function EmptyState() {
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState('');
  const [goal, setGoal] = useState('');
  const [repoRoot, setRepoRoot] = useState('');
  const setCurrentJob = useVibeDevStore((state) => state.setCurrentJob);
  const createJobMutation = useCreateJob();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !goal.trim()) return;

    try {
      const result = await createJobMutation.mutateAsync({
        title: title.trim(),
        goal: goal.trim(),
        repoRoot: repoRoot.trim() || undefined,
      });
      setCurrentJob(result.job_id);
      // Go straight to workflow editor
      useVibeDevStore.getState().setViewMode('workflow');
      setShowModal(false);
      setTitle('');
      setGoal('');
      setRepoRoot('');
    } catch (error) {
      console.error('Failed to create job:', error);
    }
  };

  return (
    <>
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="mb-4 text-6xl">🎯</div>
          <h2 className="mb-2 text-xl font-semibold">No Job Selected</h2>
          <p className="text-muted-foreground mb-4">
            Select an existing job or create a new one to get started.
          </p>
          <button
            className="btn btn-primary"
            onClick={() => setShowModal(true)}
          >
            Create New Job
          </button>
        </div>
      </div>

      {/* Create Job Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowModal(false)} />
          <div className="relative w-full max-w-lg glass-panel shadow-2xl animate-fade-in ring-1 ring-white/10 p-1">
            <div className="bg-card/90 rounded-xl p-6 space-y-6">
              <div className="space-y-1">
                <h2 className="text-xl font-bold tracking-tight">Create New Job</h2>
                <p className="text-sm text-muted-foreground">Define your mission parameters.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Build a SaaS Dashboard App"
                    className="w-full rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Goal</label>
                  <textarea
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    placeholder="Build a complete React dashboard with user management, data visualization, and real-time updates. Include auth, dark mode, and export functionality."
                    rows={3}
                    className="w-full rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Repo Path <span className="text-muted-foreground/50 lowercase font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={repoRoot}
                    onChange={(e) => setRepoRoot(e.target.value)}
                    placeholder="C:/path/to/repo"
                    className="w-full rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="btn btn-ghost"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!title.trim() || !goal.trim() || createJobMutation.isPending}
                    className="btn btn-primary"
                  >
                    {createJobMutation.isPending ? 'Creating...' : 'Create Job'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function ReviewView() {
  const uiState = useVibeDevStore((state) => state.uiState);

  if (!uiState) return null;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{uiState.job.title}</h1>
        <p className="text-muted-foreground">{uiState.job.goal}</p>
      </div>

      {/* Summary stats */}
      <div className="mb-6 grid grid-cols-4 gap-4">
        <StatCard label="Total Steps" value={uiState.steps.length} />
        <StatCard
          label="Done"
          value={uiState.steps.filter((s) => s.status === 'DONE').length}
          color="text-green-600"
        />
        <StatCard
          label="Pending"
          value={uiState.steps.filter((s) => s.status === 'PENDING').length}
          color="text-gray-600"
        />
        <StatCard label="Mistakes" value={uiState.mistakes.length} color="text-orange-600" />
      </div>

      {/* Steps summary */}
      <div className="panel">
        <div className="panel-header">
          <h3 className="panel-title">Execution Summary</h3>
        </div>
        <div className="space-y-2">
          {uiState.steps.map((step, index) => (
            <div
              key={step.step_id}
              className={cn(
                'flex items-center gap-3 rounded-md p-2',
                step.status === 'DONE' && 'bg-green-50 dark:bg-green-900/20',
                step.status === 'ACTIVE' && 'bg-blue-50 dark:bg-blue-900/20',
                step.status === 'PENDING' && 'bg-gray-50 dark:bg-gray-800/50'
              )}
            >
              <span className="text-muted-foreground text-sm w-6">{index + 1}.</span>
              <StatusIcon status={step.status} />
              <span className="flex-1">{step.title}</span>
              <span className="text-xs text-muted-foreground">
                {step.attempt_count} attempt{step.attempt_count !== 1 ? 's' : ''}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="panel">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className={cn('text-3xl font-bold', color)}>{value}</div>
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'DONE') {
    return (
      <svg className="h-5 w-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
          clipRule="evenodd"
        />
      </svg>
    );
  }
  if (status === 'ACTIVE') {
    return (
      <svg className="h-5 w-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
          clipRule="evenodd"
        />
      </svg>
    );
  }
  return (
    <svg className="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export default App;
