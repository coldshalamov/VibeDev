// =============================================================================
// VibeDev Main Application - Crystalline Command Center
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
      <div className="flex h-screen items-center justify-center bg-background text-foreground">
        <div className="text-center animate-pulse">
          <div className="mb-6 h-12 w-12 mx-auto rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm font-medium tracking-widest uppercase text-muted-foreground">Initializing System...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-background relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-10" />
        <div className="glass-panel p-8 max-w-md text-center border-red-500/30 shadow-red-500/10">
          <div className="mx-auto w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mb-4 text-red-400">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-red-500 mb-2">System Error</h3>
          <p className="text-sm text-muted-foreground mb-6 font-mono">{(error as Error).message}</p>
          <div className="flex justify-center">
            <ConnectionStatus />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background relative font-sans text-foreground">
      {/* Background FX */}
      <div className="absolute inset-0 bg-grid-pattern opacity-[0.15] pointer-events-none" />

      {/* Sidebar - Integrated Glass Pane */}
      {sidebar.isOpen && (
        <aside className="w-80 flex-shrink-0 glass border-r border-white/5 z-20 transition-all duration-300">
          <InfoSidebar />
        </aside>
      )}

      {/* Main Content Area */}
      <main className="flex flex-1 flex-col overflow-hidden relative z-10">

        {/* Floating Header */}
        <header className="h-16 flex items-center justify-between px-6 border-b border-white/5 bg-background/40 backdrop-blur-md sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <button
              onClick={() => useVibeDevStore.getState().toggleSidebar()}
              className="btn btn-ghost btn-icon text-muted-foreground hover:text-primary"
              title={sidebar.isOpen ? 'Hide sidebar' : 'Show sidebar'}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {currentJobId && (
              <button
                onClick={() => useVibeDevStore.getState().setCurrentJob(null)}
                className="btn btn-ghost btn-icon text-muted-foreground hover:text-primary"
                title="Back to Job List"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
            )}

            <div className="h-6 w-px bg-white/10" />
            <JobSelector />
          </div>

          {/* Centered View Mode Tabs - Segmented Control */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="flex items-center p-1 rounded-xl bg-black/20 border border-white/5 backdrop-blur-sm">
              <ViewModeTab mode="research" label="Research" icon="🔍" />
              <ViewModeTab mode="planning" label="Planning" icon="📐" />
              <ViewModeTab mode="execution" label="Execution" icon="⚡" />
              <ViewModeTab mode="review" label="Review" icon="📊" />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <ConnectionStatus />
            <AutomationCockpit compact />
          </div>
        </header>

        {/* Content Canvas */}
        <div className="flex-1 overflow-auto custom-scrollbar">
          <div className="min-h-full p-6">
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
        </div>
      </main>
    </div>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

function ViewModeTab({ mode, label, icon }: { mode: 'workflow' | 'research' | 'planning' | 'execution' | 'review'; label: string; icon: string }) {
  const currentMode = useViewMode();
  const setViewMode = useVibeDevStore((state) => state.setViewMode);
  const isActive = currentMode === mode;

  return (
    <button
      onClick={() => setViewMode(mode)}
      className={cn(
        'relative px-4 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all rounded-lg flex items-center gap-2',
        isActive
          ? 'text-primary bg-primary/10 shadow-[0_0_10px_-2px_rgba(var(--primary),0.3)]'
          : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
      )}
    >
      <span className={cn("opacity-70", isActive && "opacity-100")}>{icon}</span>
      {label}
      {isActive && (
        <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full shadow-[0_0_8px_currentColor]" />
      )}
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
      <div className="flex h-full min-h-[500px] flex-col items-center justify-center animate-fade-in">
        <div className="relative z-10 text-center max-w-2xl bg-card/10 backdrop-blur-sm p-12 rounded-3xl border border-white/5 ring-1 ring-white/5">
          <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 text-4xl shadow-[0_0_30px_-5px_hsl(var(--primary)/0.3)]">
            💠
          </div>
          <h2 className="mb-3 text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-white via-white to-white/50">
            VibeDev Studio
          </h2>
          <p className="text-muted-foreground mb-8 text-lg font-light leading-relaxed">
            Initialize a new mission context or resume an existing operation.<br />
            Your Glass Box Development Environment is ready.
          </p>
          <button
            className="btn btn-primary h-12 px-8 text-base rounded-xl shadow-lg shadow-cyan-500/20"
            onClick={() => setShowModal(true)}
          >
            Create New Job
          </button>
        </div>
      </div>

      {/* Create Job Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={() => setShowModal(false)} />
          <div className="relative w-full max-w-lg glass-panel shadow-2xl animate-fade-in ring-1 ring-white/10 p-1">
            <div className="bg-gradient-to-b from-card/50 to-card/90 rounded-xl p-8 space-y-8">
              <div className="space-y-2 border-b border-white/5 pb-4">
                <h2 className="text-2xl font-bold tracking-tight text-white shine-text">Initialize Mission</h2>
                <p className="text-sm text-muted-foreground">Define your operational parameters.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2 group">
                  <label className="text-xs font-bold uppercase tracking-wider text-primary/80 group-focus-within:text-primary transition-colors">Project Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Quantum Dashboard V2"
                    className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-muted-foreground/30 font-semibold"
                    autoFocus
                  />
                </div>

                <div className="space-y-2 group">
                  <label className="text-xs font-bold uppercase tracking-wider text-primary/80 group-focus-within:text-primary transition-colors">Mission Goal</label>
                  <textarea
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    placeholder="Define the end state..."
                    rows={3}
                    className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all resize-none placeholder:text-muted-foreground/30 font-medium leading-relaxed"
                  />
                </div>

                <div className="space-y-2 group">
                  <label className="text-xs font-bold uppercase tracking-wider text-primary/80 group-focus-within:text-primary transition-colors">
                    Repo Path <span className="text-muted-foreground/30 normal-case font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={repoRoot}
                    onChange={(e) => setRepoRoot(e.target.value)}
                    placeholder="C:/path/to/repo"
                    className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-muted-foreground/30 font-mono text-xs"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="btn btn-ghost text-muted-foreground hover:text-white"
                  >
                    Abort
                  </button>
                  <button
                    type="submit"
                    disabled={!title.trim() || !goal.trim() || createJobMutation.isPending}
                    className="btn btn-primary w-32 relative overflow-hidden"
                  >
                    {createJobMutation.isPending ? (
                      <span className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
                        Init...
                      </span>
                    ) : (
                      'Launch Job'
                    )}
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

// Review View - keeping basic structure but applying new card styles via utility classes
export function ReviewView() {
  const uiState = useVibeDevStore((state) => state.uiState);

  if (!uiState) return null;

  return (
    <div className="max-w-7xl mx-auto animate-fade-in">
      <div className="mb-8 flex items-end justify-between border-b border-white/5 pb-6">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60 mb-2">{uiState.job.title}</h1>
          <p className="text-muted-foreground text-lg max-w-3xl">{uiState.job.goal}</p>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Status</div>
          <div className="text-xl font-mono font-bold text-primary">REVIEW_MODE</div>
        </div>
      </div>

      {/* Summary stats */}
      <div className="mb-8 grid grid-cols-4 gap-6">
        <StatCard label="Total Steps" value={uiState.steps.length} />
        <StatCard
          label="Done"
          value={uiState.steps.filter((s) => s.status === 'DONE').length}
          color="text-emerald-400"
        />
        <StatCard
          label="Pending"
          value={uiState.steps.filter((s) => s.status === 'PENDING').length}
          color="text-blue-400"
        />
        <StatCard label="Mistakes" value={uiState.mistakes.length} color="text-amber-500" />
      </div>

      {/* Steps summary */}
      <div className="panel">
        <div className="panel-header">
          <h3 className="panel-title">Execution Log</h3>
        </div>
        <div className="p-1 space-y-1">
          {uiState.steps.map((step, index) => (
            <div
              key={step.step_id}
              className={cn(
                'flex items-center gap-4 rounded-lg p-3 transition-colors',
                step.status === 'DONE' && 'bg-emerald-500/5 border border-emerald-500/20 hover:bg-emerald-500/10',
                step.status === 'ACTIVE' && 'bg-primary/10 border border-primary/30 hover:bg-primary/20',
                step.status === 'PENDING' && 'bg-white/5 border border-white/5 hover:bg-white/10'
              )}
            >
              <span className="font-mono text-xs text-muted-foreground w-8 text-right opacity-50">#{index + 1}</span>
              <StatusIcon status={step.status} />
              <div className="flex-1">
                <div className="font-medium text-sm">{step.title}</div>
              </div>

              {step.attempt_count > 0 && (
                <span className="text-xs font-mono bg-black/30 px-2 py-1 rounded text-muted-foreground">
                  ATTEMPTS: {step.attempt_count}
                </span>
              )}
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
    <div className="glass-panel p-5 relative overflow-hidden group hover:border-white/10 transition-colors">
      <div className={`absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity ${color}`}>
        <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" /></svg>
      </div>
      <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <div className={cn('text-4xl font-mono font-light tracking-tighter', color || "text-foreground")}>{value}</div>
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'DONE') {
    return (
      <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_currentColor]" />
    );
  }
  if (status === 'ACTIVE') {
    return (
      <div className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary shadow-[0_0_8px_hsl(var(--primary))]"></span>
      </div>
    );
  }
  return (
    <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />
  );
}

export default App;
