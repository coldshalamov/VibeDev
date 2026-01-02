// =============================================================================
// VibeDev Main Application
// =============================================================================

import { useEffect } from 'react';
import { useVibeDevStore, useViewMode, useTheme } from '@/stores/useVibeDevStore';
import { useUIState } from '@/hooks/useUIState';
import { useJobEvents } from '@/hooks/useJobEvents';
import { GlobalSidebar } from '@/components/GlobalSidebar';
import { MainCanvas } from '@/components/MainCanvas';
import { ExecutionDashboard } from '@/components/ExecutionDashboard';
import { AutomationCockpit } from '@/components/AutomationCockpit';
import { JobSelector } from '@/components/JobSelector';
import { ConnectionStatus } from '@/components/ConnectionStatus';
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
      {/* Global Sidebar */}
      {sidebar.isOpen && (
        <aside className="w-80 flex-shrink-0 animate-slide-in-left">
          <GlobalSidebar />
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
            <JobSelector />
          </div>

          {/* View Mode Tabs */}
          <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
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
          ) : viewMode === 'planning' ? (
            <MainCanvas />
          ) : viewMode === 'execution' ? (
            <ExecutionDashboard />
          ) : (
            <ReviewView />
          )}
        </div>
      </main>
    </div>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

function ViewModeTab({ mode, label }: { mode: 'planning' | 'execution' | 'review'; label: string }) {
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
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <div className="mb-4 text-6xl">🎯</div>
        <h2 className="mb-2 text-xl font-semibold">No Job Selected</h2>
        <p className="text-muted-foreground mb-4">
          Select an existing job or create a new one to get started.
        </p>
        <button className="btn btn-primary">Create New Job</button>
      </div>
    </div>
  );
}

function ReviewView() {
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
