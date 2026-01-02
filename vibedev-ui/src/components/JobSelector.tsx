// =============================================================================
// Job Selector Component (Glassmorphism)
// =============================================================================

import { useState, useRef, useEffect } from 'react';
import { useVibeDevStore } from '@/stores/useVibeDevStore';
import { useJobsList, useCreateJob } from '@/hooks/useUIState';
import { cn, getStatusColor } from '@/lib/utils';
import { PlusIcon, ChevronDownIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'; // Using Heroicons

export function JobSelector() {
  const [isOpen, setIsOpen] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentJobId = useVibeDevStore((state) => state.currentJobId);
  const uiState = useVibeDevStore((state) => state.uiState);
  const setCurrentJob = useVibeDevStore((state) => state.setCurrentJob);

  const { data: jobsList, isLoading } = useJobsList();
  const currentJob = uiState?.job;

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownRef]);

  return (
    <div className="relative font-sans" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-3 rounded-xl border border-white/5 bg-white/5 px-4 py-2 hover:bg-white/10 transition-all duration-300 w-[300px]",
          isOpen && "ring-2 ring-primary/50 bg-white/10"
        )}
      >
        {currentJob ? (
          <>
            <StatusIndicator status={currentJob.status} />
            <div className="flex-1 text-left min-w-0">
              <div className="font-semibold text-sm truncate leading-tight">{currentJob.title}</div>
              <div className="text-[10px] text-muted-foreground truncate leading-tight opacity-70">{currentJob.goal}</div>
            </div>
          </>
        ) : (
          <span className="text-muted-foreground text-sm flex-1 text-left">Select a job...</span>
        )}
        <ChevronDownIcon className={cn("h-4 w-4 text-muted-foreground transition-transform duration-300", isOpen && "rotate-180")} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-[350px] z-50 animate-fade-in origin-top-left">
          <div className="glass-panel overflow-hidden shadow-2xl ring-1 ring-black/50">

            {/* Header / Actions */}
            <div className="p-2 border-b border-white/5 bg-black/20">
              <button
                onClick={() => {
                  setShowCreateModal(true);
                  setIsOpen(false);
                }}
                className="w-full group flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-primary hover:bg-primary/10 transition-colors"
              >
                <PlusIcon className="h-4 w-4" />
                <span>Initialize New Operation</span>
              </button>
            </div>

            {/* Job List */}
            <div className="max-h-[400px] overflow-y-auto p-2 custom-scrollbar">
              {isLoading ? (
                <div className="p-8 text-center text-muted-foreground text-sm flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-primary/50 border-t-transparent rounded-full animate-spin" />
                  Loading ops...
                </div>
              ) : jobsList?.jobs.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  No active jobs found.
                </div>
              ) : (
                <div className="space-y-1">
                  {jobsList?.jobs.map((job) => (
                    <button
                      key={job.job_id}
                      onClick={() => {
                        setCurrentJob(job.job_id);
                        setIsOpen(false);
                      }}
                      className={cn(
                        'w-full flex items-start gap-3 rounded-lg px-3 py-3 text-left transition-all duration-200 group',
                        currentJobId === job.job_id
                          ? 'bg-primary/20 ring-1 ring-primary/50'
                          : 'hover:bg-white/5'
                      )}
                    >
                      <StatusIndicator status={job.status} small />
                      <div className="flex-1 min-w-0">
                        <div className={cn("font-medium text-sm truncate mb-0.5", currentJobId === job.job_id ? "text-primary" : "text-foreground group-hover:text-primary-foreground")}>
                          {job.title}
                        </div>
                        <div className="text-xs text-muted-foreground truncate opacity-70">
                          {job.goal}
                        </div>
                      </div>
                      {currentJobId === job.job_id && (
                        <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(59,130,246,0.8)] mt-2" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CreateJobModal onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Sub-components
// -----------------------------------------------------------------------------

function StatusIndicator({ status, small }: { status: string; small?: boolean }) {
  const colorClass = getStatusColor(status);
  // Extract roughly the color name to use for shadow class if needed, or simple dynamic style
  const isExecuting = status === 'EXECUTING';

  return (
    <div className={cn(
      "rounded-full flex items-center justify-center shadow-sm shrink-0",
      small ? "w-6 h-6 bg-white/5" : "w-8 h-8 bg-white/5 border border-white/10"
    )}>
      <div className={cn(
        "rounded-full",
        small ? "w-2 h-2" : "w-3 h-3",
        colorClass.replace('text-', 'bg-'),
        isExecuting && "animate-pulse shadow-[0_0_10px_currentColor]"
      )} />
    </div>
  );
}

function CreateJobModal({ onClose }: { onClose: () => void }) {
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
      onClose();
    } catch (error) {
      console.error('Failed to create job:', error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose} />

      {/* Modal Card */}
      <div className="relative w-full max-w-lg glass-panel shadow-2xl animate-fade-in ring-1 ring-white/10 p-1">
        <div className="bg-card/90 rounded-xl p-6 space-y-6">
          <div className="space-y-1">
            <h2 className="text-xl font-bold tracking-tight">Initialize New Operation</h2>
            <p className="text-sm text-muted-foreground">Define the mission parameters for the new job.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mission Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Refactor Auth System"
                className="w-full rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-muted-foreground/50"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Strategic Goal</label>
              <textarea
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="Describe the desired end state..."
                rows={3}
                className="w-full rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-muted-foreground/50 resize-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Target Repo <span className="text-muted-foreground/50 lowercase font-normal">(optional)</span>
              </label>
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={repoRoot}
                  onChange={(e) => setRepoRoot(e.target.value)}
                  placeholder="Absolute path to repository..."
                  className="w-full rounded-lg border border-white/10 bg-black/20 pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-mono placeholder:text-muted-foreground/50"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-white/5 text-muted-foreground transition-colors"
              >
                Abort
              </button>
              <button
                type="submit"
                disabled={!title.trim() || !goal.trim() || createJobMutation.isPending}
                className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createJobMutation.isPending ? 'Initializing...' : 'Launch Mission'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
