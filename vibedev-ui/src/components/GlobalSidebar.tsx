// =============================================================================
// Global Sidebar Component
// =============================================================================

import { useVibeDevStore } from '@/stores/useVibeDevStore';
import { cn, formatDate } from '@/lib/utils';

export function GlobalSidebar() {
  const uiState = useVibeDevStore((state) => state.uiState);
  const sidebar = useVibeDevStore((state) => state.sidebar);
  const setSidebarSection = useVibeDevStore((state) => state.setSidebarSection);

  if (!uiState) {
    return (
      <div className="sidebar h-full">
        <div className="p-4 text-center text-muted-foreground">
          No job selected
        </div>
      </div>
    );
  }

  const { job, phase, mistakes, planning_answers } = uiState;

  return (
    <div className="sidebar h-full overflow-hidden flex flex-col">
      {/* Job Header */}
      <div className="sidebar-section">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold truncate">{job.title}</h2>
            <p className="text-sm text-muted-foreground truncate-2">
              {job.goal}
            </p>
          </div>
          <StatusBadge status={job.status} />
        </div>
      </div>

      {/* Section Tabs */}
      <div className="flex border-b">
        <SidebarTab
          active={sidebar.activeSection === 'metadata'}
          onClick={() => setSidebarSection('metadata')}
          label="Info"
        />
        <SidebarTab
          active={sidebar.activeSection === 'invariants'}
          onClick={() => setSidebarSection('invariants')}
          label="Rules"
          count={job.invariants?.length}
        />
        <SidebarTab
          active={sidebar.activeSection === 'mistakes'}
          onClick={() => setSidebarSection('mistakes')}
          label="Mistakes"
          count={mistakes.length}
        />
        <SidebarTab
          active={sidebar.activeSection === 'context'}
          onClick={() => setSidebarSection('context')}
          label="Context"
        />
      </div>

      {/* Section Content */}
      <div className="flex-1 overflow-auto">
        {sidebar.activeSection === 'metadata' && (
          <MetadataSection job={job} phase={phase} planningAnswers={planning_answers} />
        )}
        {sidebar.activeSection === 'invariants' && (
          <InvariantsSection invariants={job.invariants || []} />
        )}
        {sidebar.activeSection === 'mistakes' && (
          <MistakesSection mistakes={mistakes} />
        )}
        {sidebar.activeSection === 'context' && (
          <ContextSection uiState={uiState} />
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

function SidebarTab({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex-1 px-3 py-2 text-sm font-medium transition-colors relative',
        active
          ? 'text-primary border-b-2 border-primary'
          : 'text-muted-foreground hover:text-foreground'
      )}
    >
      {label}
      {count !== undefined && count > 0 && (
        <span className="ml-1 text-xs bg-muted px-1.5 py-0.5 rounded-full">
          {count}
        </span>
      )}
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'px-2 py-0.5 rounded-full text-xs font-medium',
        `badge-${status.toLowerCase()}`
      )}
    >
      {status}
    </span>
  );
}

function MetadataSection({
  job,
  phase,
  planningAnswers,
}: {
  job: any;
  phase: any;
  planningAnswers: Record<string, any>;
}) {
  return (
    <div className="p-4 space-y-4">
      {/* Phase Progress */}
      <div>
        <h3 className="text-sm font-medium mb-2">Planning Progress</h3>
        <div className="space-y-2">
          <PhaseIndicator
            name="Intent & Scope"
            phase={1}
            currentPhase={phase.current_phase}
          />
          <PhaseIndicator
            name="Deliverables"
            phase={2}
            currentPhase={phase.current_phase}
          />
          <PhaseIndicator
            name="Invariants"
            phase={3}
            currentPhase={phase.current_phase}
          />
          {phase.has_repo && (
            <PhaseIndicator
              name="Repo Context"
              phase={4}
              currentPhase={phase.current_phase}
            />
          )}
          <PhaseIndicator
            name="Plan Steps"
            phase={5}
            currentPhase={phase.current_phase}
          />
        </div>
      </div>

      {/* Key Info */}
      <div>
        <h3 className="text-sm font-medium mb-2">Job Details</h3>
        <dl className="text-sm space-y-1">
          <InfoRow label="Job ID" value={job.job_id.slice(0, 8)} />
          <InfoRow label="Created" value={formatDate(job.created_at)} />
          {job.repo_root && (
            <InfoRow label="Repo" value={job.repo_root} truncate />
          )}
          {planningAnswers.target_environment && (
            <InfoRow
              label="Environment"
              value={planningAnswers.target_environment}
              truncate
            />
          )}
          {planningAnswers.timeline_priority && (
            <InfoRow
              label="Priority"
              value={planningAnswers.timeline_priority}
            />
          )}
        </dl>
      </div>

      {/* Deliverables */}
      {job.deliverables?.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-2">Deliverables</h3>
          <ul className="text-sm space-y-1">
            {job.deliverables.map((d: string, i: number) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-muted-foreground">•</span>
                <span>{d}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Definition of Done */}
      {job.definition_of_done?.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-2">Definition of Done</h3>
          <ul className="text-sm space-y-1">
            {job.definition_of_done.map((d: string, i: number) => (
              <li key={i} className="flex items-start gap-2">
                <input
                  type="checkbox"
                  disabled
                  className="mt-0.5 rounded border-gray-300"
                />
                <span>{d}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function PhaseIndicator({
  name,
  phase,
  currentPhase,
}: {
  name: string;
  phase: number;
  currentPhase: number;
}) {
  const isComplete = phase < currentPhase;
  const isCurrent = phase === currentPhase;

  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          'h-5 w-5 rounded-full flex items-center justify-center text-xs',
          isComplete && 'bg-green-500 text-white',
          isCurrent && 'bg-blue-500 text-white pulse-active',
          !isComplete && !isCurrent && 'bg-muted text-muted-foreground'
        )}
      >
        {isComplete ? '✓' : phase}
      </div>
      <span
        className={cn(
          'text-sm',
          isCurrent && 'font-medium',
          !isComplete && !isCurrent && 'text-muted-foreground'
        )}
      >
        {name}
      </span>
    </div>
  );
}

function InfoRow({
  label,
  value,
  truncate,
}: {
  label: string;
  value: string;
  truncate?: boolean;
}) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn('text-right', truncate && 'truncate max-w-[150px]')}>
        {value}
      </dd>
    </div>
  );
}

function InvariantsSection({ invariants }: { invariants: string[] }) {
  if (invariants.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <p>No invariants defined yet.</p>
        <p className="text-sm mt-1">
          Invariants are non-negotiable rules that must be followed.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="space-y-2">
        {invariants.map((inv, i) => (
          <div
            key={i}
            className="flex items-start gap-2 p-2 rounded-md bg-orange-50 border border-orange-200 dark:bg-orange-900/20 dark:border-orange-800"
          >
            <span className="text-orange-500">⚠️</span>
            <span className="text-sm">{inv}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MistakesSection({ mistakes }: { mistakes: any[] }) {
  if (mistakes.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <p>No mistakes recorded.</p>
        <p className="text-sm mt-1">
          Mistakes help the AI learn and avoid repeating errors.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      {mistakes.map((mistake) => (
        <div
          key={mistake.mistake_id}
          className="p-3 rounded-lg border bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800"
        >
          <h4 className="font-medium text-sm mb-1">{mistake.title}</h4>
          <p className="text-xs text-muted-foreground mb-2">
            {mistake.lesson}
          </p>
          {mistake.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {mistake.tags.map((tag: string) => (
                <span
                  key={tag}
                  className="px-1.5 py-0.5 text-xs rounded bg-red-100 dark:bg-red-800/50"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ContextSection({ uiState }: { uiState: any }) {
  const { context_block_count, repo_map, git_status } = uiState;

  return (
    <div className="p-4 space-y-4">
      {/* Context Blocks */}
      <div>
        <h3 className="text-sm font-medium mb-2">Context Blocks</h3>
        <p className="text-sm text-muted-foreground">
          {context_block_count} blocks stored
        </p>
      </div>

      {/* Repo Map */}
      {repo_map?.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-2">Repo Map</h3>
          <ul className="text-sm space-y-1 max-h-40 overflow-auto">
            {repo_map.slice(0, 10).map((entry: any, i: number) => (
              <li key={i} className="text-muted-foreground truncate">
                {entry.path}
              </li>
            ))}
            {repo_map.length > 10 && (
              <li className="text-muted-foreground italic">
                +{repo_map.length - 10} more files
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Git Status */}
      {git_status?.ok && (
        <div>
          <h3 className="text-sm font-medium mb-2">Git Status</h3>
          {git_status.clean ? (
            <p className="text-sm text-green-600">Working tree clean</p>
          ) : (
            <div className="text-sm space-y-1">
              {git_status.modified?.length > 0 && (
                <p className="text-yellow-600">
                  {git_status.modified.length} modified
                </p>
              )}
              {git_status.added?.length > 0 && (
                <p className="text-green-600">
                  {git_status.added.length} added
                </p>
              )}
              {git_status.deleted?.length > 0 && (
                <p className="text-red-600">
                  {git_status.deleted.length} deleted
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
