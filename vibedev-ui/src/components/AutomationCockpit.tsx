// =============================================================================
// Automation Cockpit Component - Play/Pause, Thread Manager
// =============================================================================

import { useState } from 'react';
import { useVibeDevStore, useAutomation } from '@/stores/useVibeDevStore';
import { usePauseJob, useResumeJob, useFailJob } from '@/hooks/useUIState';
import { cn } from '@/lib/utils';

interface AutomationCockpitProps {
  compact?: boolean;
}

export function AutomationCockpit({ compact = false }: AutomationCockpitProps) {
  const currentJobId = useVibeDevStore((state) => state.currentJobId);
  const uiState = useVibeDevStore((state) => state.uiState);
  const automation = useAutomation();
  const toggleAutoMode = useVibeDevStore((state) => state.toggleAutoMode);
  const setClipboardBridge = useVibeDevStore((state) => state.setClipboardBridge);

  const [showSettings, setShowSettings] = useState(false);

  const pauseMutation = usePauseJob(currentJobId || '');
  const resumeMutation = useResumeJob(currentJobId || '');

  const hasJob = currentJobId && uiState;
  const isExecuting = hasJob && uiState.job.status === 'EXECUTING';
  const isPaused = hasJob && uiState.job.status === 'PAUSED';
  const canControl = isExecuting || isPaused;

  if (compact) {
    return (
      <div className="flex items-center gap-3 relative">
        {/* Status indicator - only show if job exists */}
        {hasJob && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/5">
            <StatusIndicator status={uiState.job.status} />
            <span className="text-[10px] font-bold tracking-widest uppercase opacity-80 hidden sm:inline">
              {uiState.job.status}
            </span>
          </div>
        )}

        {/* Control buttons - only show if can control */}
        {canControl && (
          <div className="flex items-center gap-1">
            {isPaused ? (
              <button
                onClick={() => resumeMutation.mutate()}
                disabled={resumeMutation.isPending}
                className="btn btn-ghost btn-icon text-emerald-400 hover:bg-emerald-400/10 hover:shadow-[0_0_15px_-5px_#34d399]"
                title="Resume"
              >
                <PlayIcon />
              </button>
            ) : (
              <button
                onClick={() => pauseMutation.mutate()}
                disabled={pauseMutation.isPending}
                className="btn btn-ghost btn-icon text-amber-400 hover:bg-amber-400/10 hover:shadow-[0_0_15px_-5px_#fbbf24]"
                title="Pause"
              >
                <PauseIcon />
              </button>
            )}
          </div>
        )}

        {/* Settings button - ALWAYS visible */}
        <button
          onClick={() => setShowSettings(!showSettings)}
          className={cn(
            "btn btn-ghost btn-icon transition-all duration-300",
            showSettings ? "bg-white/10 text-white rotate-90" : "text-muted-foreground"
          )}
          title="Settings"
        >
          <SettingsIcon />
        </button>

        {/* Settings dropdown */}
        {showSettings && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]"
              onClick={() => setShowSettings(false)}
            />
            <div className="absolute right-0 top-full mt-2 z-50 w-80 glass-panel shadow-2xl animate-fade-in border border-white/10 ring-1 ring-black/50">
              <AutomationSettingsPanel />
            </div>
          </>
        )}
      </div>
    );
  }

  if (!uiState) return null;

  // Full panel view
  return (
    <div className="panel overflow-visible">
      <div className="panel-header">
        <h3 className="panel-title">Automation Cockpit</h3>
        <StatusIndicator status={uiState.job.status} />
      </div>

      {/* Main controls */}
      <div className="p-6 space-y-8">
        {/* Playback controls */}
        <div className="flex items-center justify-center gap-6">
          {canControl && (
            <>
              {isPaused ? (
                <button
                  onClick={() => resumeMutation.mutate()}
                  disabled={resumeMutation.isPending}
                  className="h-20 w-20 rounded-full bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 flex items-center justify-center hover:bg-emerald-500/30 hover:scale-105 hover:shadow-[0_0_30px_-5px_#34d399] transition-all group"
                  title="Resume"
                >
                  <PlayIcon className="h-10 w-10 fill-current group-hover:drop-shadow-[0_0_5px_currentColor]" />
                </button>
              ) : (
                <button
                  onClick={() => pauseMutation.mutate()}
                  disabled={pauseMutation.isPending}
                  className="h-20 w-20 rounded-full bg-amber-500/20 border border-amber-500/50 text-amber-400 flex items-center justify-center hover:bg-amber-500/30 hover:scale-105 hover:shadow-[0_0_30px_-5px_#fbbf24] transition-all group"
                  title="Pause"
                >
                  <PauseIcon className="h-10 w-10 fill-current group-hover:drop-shadow-[0_0_5px_currentColor]" />
                </button>
              )}

              <FailJobButton jobId={currentJobId} />
            </>
          )}
        </div>

        {/* Step progress */}
        <div className="bg-black/20 rounded-lg p-4 border border-white/5">
          <div className="flex justify-between text-xs font-mono mb-3 text-muted-foreground uppercase tracking-wider">
            <span>Mission Progress</span>
            <span>
              <span className="text-white font-bold">{uiState.steps.filter((s) => s.status === 'DONE').length}</span>
              <span className="opacity-50 mx-1">/</span>
              <span>{uiState.steps.length}</span>
            </span>
          </div>
          <div className="h-2 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary shadow-[0_0_10px_currentColor] transition-all duration-700 ease-out"
              style={{
                width: `${(uiState.steps.filter((s) => s.status === 'DONE').length /
                  uiState.steps.length) *
                  100
                  }%`,
              }}
            />
          </div>
        </div>

        {/* Auto mode toggle */}
        <div className="space-y-4">
          <label className="flex items-center justify-between cursor-pointer group p-3 rounded-lg hover:bg-white/5 transition-colors border border-transparent hover:border-white/5">
            <div>
              <div className="font-bold text-sm group-hover:text-primary transition-colors">Auto Pilot</div>
              <div className="text-xs text-muted-foreground/70">
                Engage automatic sequence progression
              </div>
            </div>
            <ToggleSwitch checked={automation.isAutoMode} onChange={toggleAutoMode} />
          </label>

          <label className="flex items-center justify-between cursor-pointer group p-3 rounded-lg hover:bg-white/5 transition-colors border border-transparent hover:border-white/5">
            <div>
              <div className="font-bold text-sm group-hover:text-primary transition-colors">Clipboard Bridge</div>
              <div className="text-xs text-muted-foreground/70">
                Sync prompt data to system clipboard
              </div>
            </div>
            <ToggleSwitch
              checked={automation.clipboardBridge}
              onChange={(checked) => setClipboardBridge(checked)}
            />
          </label>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

function AutomationSettingsPanel() {
  const automation = useAutomation();
  const toggleAutoMode = useVibeDevStore((state) => state.toggleAutoMode);
  const setAutoAdvanceSteps = useVibeDevStore((state) => state.setAutoAdvanceSteps);
  const setClipboardBridge = useVibeDevStore((state) => state.setClipboardBridge);
  const theme = useVibeDevStore((state) => state.theme);
  const setTheme = useVibeDevStore((state) => state.setTheme);

  return (
    <div className="p-5 space-y-6">
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">System Config</h4>
      </div>

      {/* Theme */}
      <div>
        <label className="block text-xs font-medium mb-3 text-muted-foreground uppercase tracking-wider pl-1">Visual Mode</label>
        <div className="grid grid-cols-3 gap-2 bg-black/20 p-1 rounded-lg border border-white/5">
          {(['light', 'dark', 'system'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className={cn(
                'py-1.5 rounded text-xs font-bold uppercase transition-all',
                theme === t
                  ? 'bg-primary/20 text-primary shadow-[0_0_10px_-4px_rgba(var(--primary),0.5)] ring-1 ring-primary/50'
                  : 'text-muted-foreground hover:text-white hover:bg-white/5'
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {/* Auto mode */}
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-sm font-medium">Auto Pilot</span>
          <ToggleSwitch checked={automation.isAutoMode} onChange={toggleAutoMode} />
        </label>

        {/* Auto advance */}
        <label className="flex items-center justify-between cursor-pointer">
          <div className="flex flex-col">
            <span className="text-sm font-medium">Auto Commit</span>
            <span className="text-[10px] text-muted-foreground">Advance step on success</span>
          </div>
          <ToggleSwitch
            checked={automation.autoAdvanceSteps}
            onChange={(checked) => setAutoAdvanceSteps(checked)}
          />
        </label>

        {/* Clipboard bridge */}
        <label className="flex items-center justify-between cursor-pointer">
          <div className="flex flex-col">
            <span className="text-sm font-medium">Clipboard Link</span>
            <span className="text-[10px] text-muted-foreground">Sync prompts to OS</span>
          </div>
          <ToggleSwitch
            checked={automation.clipboardBridge}
            onChange={(checked) => setClipboardBridge(checked)}
          />
        </label>
      </div>
    </div>
  );
}

function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={cn(
        'relative w-10 h-5 rounded-full transition-all duration-300 shadow-inner',
        checked ? 'bg-primary shadow-[0_0_10px_currentColor]' : 'bg-white/10'
      )}
    >
      <div
        className={cn(
          'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-300',
          checked ? 'translate-x-5' : 'translate-x-0.5'
        )}
      />
    </button>
  );
}

function StatusIndicator({ status }: { status: string }) {
  const colors: Record<string, string> = {
    PLANNING: 'bg-yellow-500 shadow-[0_0_8px_#eab308]',
    READY: 'bg-green-500 shadow-[0_0_8px_#22c55e]',
    EXECUTING: 'bg-cyan-500 shadow-[0_0_12px_#06b6d4] animate-pulse',
    PAUSED: 'bg-orange-500 shadow-[0_0_8px_#f97316]',
    COMPLETE: 'bg-emerald-500 shadow-[0_0_8px_#10b981]',
    FAILED: 'bg-red-500 shadow-[0_0_8px_#ef4444]',
    ARCHIVED: 'bg-gray-500',
  };

  return (
    <div className={cn('h-2.5 w-2.5 rounded-full', colors[status] || 'bg-gray-400')} />
  );
}

function FailJobButton({ jobId }: { jobId: string }) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [reason, setReason] = useState('');
  const failMutation = useFailJob(jobId);

  if (!showConfirm) {
    return (
      <button
        onClick={() => setShowConfirm(true)}
        className="h-10 w-10 rounded-full bg-red-500/10 text-red-500 border border-red-500/20 flex items-center justify-center hover:bg-red-500/20 hover:scale-105 transition-all opacity-50 hover:opacity-100"
        title="Fail job"
      >
        <StopIcon />
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-xl glass-panel p-6 shadow-2xl animate-fade-in ring-1 ring-red-500/30">
        <h3 className="text-lg font-bold mb-4 text-red-500 flex items-center gap-2">
          <StopIcon className="w-5 h-5" /> Abort Mission?
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Emergency termination. This action is irreversible.
        </p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Failure reason log..."
          rows={3}
          className="w-full rounded-lg border border-red-500/20 bg-black/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50 resize-none mb-4 placeholder:text-red-500/20 text-red-100"
          autoFocus
        />
        <div className="flex gap-3">
          <button
            onClick={() => setShowConfirm(false)}
            className="btn btn-ghost flex-1 text-muted-foreground hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={async () => {
              await failMutation.mutateAsync(reason || 'No reason provided');
              setShowConfirm(false);
            }}
            disabled={failMutation.isPending}
            className="btn bg-red-600 hover:bg-red-700 text-white flex-1 shadow-[0_0_15px_-5px_#dc2626]"
          >
            {failMutation.isPending ? 'Aborting...' : 'Confirm Abort'}
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Icons
// =============================================================================

function PlayIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function PauseIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20">
      <path
        fillRule="evenodd"
        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function StopIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function SettingsIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}
