// =============================================================================
// Job Selector Component
// =============================================================================

import { useState } from 'react';
import { useVibeDevStore } from '@/stores/useVibeDevStore';
import { useJobsList, useCreateJob } from '@/hooks/useUIState';
import { cn, getStatusColor } from '@/lib/utils';

export function JobSelector() {
  const [isOpen, setIsOpen] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const currentJobId = useVibeDevStore((state) => state.currentJobId);
  const uiState = useVibeDevStore((state) => state.uiState);
  const setCurrentJob = useVibeDevStore((state) => state.setCurrentJob);

  const { data: jobsList, isLoading } = useJobsList();

  const currentJob = uiState?.job;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm hover:bg-accent"
      >
        {currentJob ? (
          <>
            <StatusDot status={currentJob.status} />
            <span className="font-medium max-w-[200px] truncate">
              {currentJob.title}
            </span>
          </>
        ) : (
          <span className="text-muted-foreground">Select a job...</span>
        )}
        <svg
          className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute left-0 top-full z-20 mt-1 w-80 rounded-lg border bg-card shadow-lg animate-fade-in">
            <div className="p-2 border-b">
              <button
                onClick={() => {
                  setShowCreateModal(true);
                  setIsOpen(false);
                }}
                className="w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm text-primary hover:bg-accent"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Create New Job
              </button>
            </div>

            <div className="max-h-96 overflow-auto p-2">
              {isLoading ? (
                <div className="p-4 text-center text-muted-foreground">
                  Loading jobs...
                </div>
              ) : jobsList?.jobs.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  No jobs found
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
                        'w-full flex items-start gap-3 rounded-md px-3 py-2 text-left hover:bg-accent',
                        currentJobId === job.job_id && 'bg-accent'
                      )}
                    >
                      <StatusDot status={job.status} />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{job.title}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {job.goal}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CreateJobModal onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

function StatusDot({ status }: { status: string }) {
  const colorClass = getStatusColor(status);
  return (
    <span
      className={cn(
        'h-2 w-2 rounded-full flex-shrink-0 mt-1.5',
        colorClass.replace('text-', 'bg-')
      )}
    />
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
    <>
      <div
        className="fixed inset-0 z-40 bg-black/50"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl animate-fade-in">
          <h2 className="text-lg font-semibold mb-4">Create New Job</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Implement user authentication"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Goal</label>
              <textarea
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="Describe what you want to achieve..."
                rows={3}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Repository Root <span className="text-muted-foreground">(optional)</span>
              </label>
              <input
                type="text"
                value={repoRoot}
                onChange={(e) => setRepoRoot(e.target.value)}
                placeholder="/path/to/repo"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="btn btn-outline flex-1"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!title.trim() || !goal.trim() || createJobMutation.isPending}
                className="btn btn-primary flex-1"
              >
                {createJobMutation.isPending ? 'Creating...' : 'Create Job'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
