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

  if (!currentJobId || !uiState) {
    return null;
  }

  const isExecuting = uiState.job.status === 'EXECUTING';
  const isPaused = uiState.job.status === 'PAUSED';
  const canControl = isExecuting || isPaused;

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {/* Status indicator */}
        <div className="flex items-center gap-2">
          <StatusIndicator status={uiState.job.status} />
          <span className="text-sm font-medium hidden sm:inline">
            {uiState.job.status}
          </span>
        </div>

        {/* Control buttons */}
        {canControl && (
          <div className="flex items-center gap-1">
            {isPaused ? (
              <button
                onClick={() => resumeMutation.mutate()}
                disabled={resumeMutation.isPending}
                className="btn btn-ghost btn-icon text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30"
                title="Resume"
              >
                <PlayIcon />
              </button>
            ) : (
              <button
                onClick={() => pauseMutation.mutate()}
                disabled={pauseMutation.isPending}
                className="btn btn-ghost btn-icon text-yellow-600 hover:bg-yellow-100 dark:hover:bg-yellow-900/30"
                title="Pause"
              >
                <PauseIcon />
              </button>
            )}
          </div>
        )}

        {/* Settings button */}
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="btn btn-ghost btn-icon"
          title="Automation settings"
        >
          <SettingsIcon />
        </button>

        {/* Settings dropdown */}
        {showSettings && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setShowSettings(false)}
            />
            <div className="absolute right-0 top-full mt-2 z-20 w-72 rounded-lg border bg-card shadow-lg animate-fade-in">
              <AutomationSettingsPanel />
            </div>
          </>
        )}
      </div>
    );
  }

  // Full panel view
  return (
    <div className="panel">
      <div className="panel-header">
        <h3 className="panel-title">Automation Cockpit</h3>
        <StatusIndicator status={uiState.job.status} />
      </div>

      {/* Main controls */}
      <div className="space-y-4">
        {/* Playback controls */}
        <div className="flex items-center justify-center gap-4 py-4">
          {canControl && (
            <>
              {isPaused ? (
                <button
                  onClick={() => resumeMutation.mutate()}
                  disabled={resumeMutation.isPending}
                  className="h-14 w-14 rounded-full bg-green-500 text-white flex items-center justify-center hover:bg-green-600 transition-colors"
                  title="Resume"
                >
                  <PlayIcon className="h-8 w-8" />
                </button>
              ) : (
                <button
                  onClick={() => pauseMutation.mutate()}
                  disabled={pauseMutation.isPending}
                  className="h-14 w-14 rounded-full bg-yellow-500 text-white flex items-center justify-center hover:bg-yellow-600 transition-colors"
                  title="Pause"
                >
                  <PauseIcon className="h-8 w-8" />
                </button>
              )}

              <FailJobButton jobId={currentJobId} />
            </>
          )}
        </div>

        {/* Step progress */}
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span>Progress</span>
            <span>
              {uiState.steps.filter((s) => s.status === 'DONE').length} /{' '}
              {uiState.steps.length} steps
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all"
              style={{
                width: `${
                  (uiState.steps.filter((s) => s.status === 'DONE').length /  
                    uiState.steps.length) *
                  100
                }%`,
              }}
            />
          </div>
        </div>

        {/* Auto mode toggle */}
        <div className="border-t pt-4">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <div className="font-medium text-sm">Auto Mode</div>
              <div className="text-xs text-muted-foreground">
                Automatically advance to next step when current completes
              </div>
            </div>
            <input
              type="checkbox"
              checked={automation.isAutoMode}
              onChange={toggleAutoMode}
              className="toggle"
            />
          </label>
        </div>

        {/* Clipboard bridge toggle */}
        <div>
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <div className="font-medium text-sm">Clipboard Bridge</div>
              <div className="text-xs text-muted-foreground">
                Copy step prompts to clipboard automatically
              </div>
            </div>
            <input
              type="checkbox"
              checked={automation.clipboardBridge}
              onChange={(e) => setClipboardBridge(e.target.checked)}
              className="toggle"
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
    <div className="p-4 space-y-4">
      <h4 className="font-medium">Settings</h4>

      {/* Theme */}
      <div>
        <label className="block text-sm font-medium mb-2">Theme</label>
        <div className="flex gap-2">
          {(['light', 'dark', 'system'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className={cn(
                'flex-1 py-1.5 rounded-md border text-sm capitalize',
                theme === t ? 'bg-primary text-primary-foreground' : 'bg-background'
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Auto mode */}
      <label className="flex items-center justify-between cursor-pointer">
        <span className="text-sm">Auto Mode</span>
        <ToggleSwitch checked={automation.isAutoMode} onChange={toggleAutoMode} />
      </label>

      {/* Auto advance */}
      <label className="flex items-center justify-between cursor-pointer">
        <span className="text-sm">Auto Advance Steps</span>
        <ToggleSwitch
          checked={automation.autoAdvanceSteps}
          onChange={(checked) => setAutoAdvanceSteps(checked)}
        />
      </label>

      {/* Clipboard bridge */}
      <label className="flex items-center justify-between cursor-pointer">
        <span className="text-sm">Clipboard Bridge</span>
        <ToggleSwitch
          checked={automation.clipboardBridge}
          onChange={(checked) => setClipboardBridge(checked)}
        />
      </label>
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
        'relative w-11 h-6 rounded-full transition-colors',
        checked ? 'bg-primary' : 'bg-muted'
      )}
    >
      <div
        className={cn(
          'absolute top-1 h-4 w-4 rounded-full bg-white transition-transform',
          checked ? 'translate-x-6' : 'translate-x-1'
        )}
      />
    </button>
  );
}

function StatusIndicator({ status }: { status: string }) {
  const colors: Record<string, string> = {
    PLANNING: 'bg-yellow-500',
    READY: 'bg-green-500',
    EXECUTING: 'bg-blue-500 animate-pulse',
    PAUSED: 'bg-orange-500',
    COMPLETE: 'bg-emerald-500',
    FAILED: 'bg-red-500',
    ARCHIVED: 'bg-gray-500',
  };

  return (
    <div className={cn('h-3 w-3 rounded-full', colors[status] || 'bg-gray-400')} />
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
        className="h-10 w-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center hover:bg-red-200 transition-colors dark:bg-red-900/30 dark:hover:bg-red-900/50"
        title="Fail job"
      >
        <StopIcon />
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl animate-fade-in">
        <h3 className="text-lg font-semibold mb-4 text-red-600">Fail Job?</h3>
        <p className="text-sm text-muted-foreground mb-4">
          This will mark the job as failed. This action cannot be undone.
        </p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason for failure..."
          rows={3}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none mb-4"
        />
        <div className="flex gap-3">
          <button
            onClick={() => setShowConfirm(false)}
            className="btn btn-outline flex-1"
          >
            Cancel
          </button>
          <button
            onClick={async () => {
              await failMutation.mutateAsync(reason || 'No reason provided');
              setShowConfirm(false);
            }}
            disabled={failMutation.isPending}
            className="btn btn-destructive flex-1"
          >
            {failMutation.isPending ? 'Failing...' : 'Fail Job'}
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
