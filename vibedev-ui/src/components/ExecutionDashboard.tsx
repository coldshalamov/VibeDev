// =============================================================================
// Execution Dashboard "Glass Box"
// =============================================================================

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useVibeDevStore } from '@/stores/useVibeDevStore';
import { useResumeJob, useStartJob, useStepPrompt, useSubmitStepResult } from '@/hooks/useUIState';
import { cn, formatDate } from '@/lib/utils';
import {
  ArrowPathIcon,
  BeakerIcon,
  CheckCircleIcon,
  CommandLineIcon,
  PauseIcon,
  PlayIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { GateResultsPanel, GateResultsPanelSkeleton } from './GateResultsPanel';
import { useSWR } from 'swr';
import { fetcher } from '@/lib/api';

export function ExecutionDashboard() {
  const uiState = useVibeDevStore((state) => state.uiState);
  const currentJobId = useVibeDevStore((state) => state.currentJobId);

  if (!uiState || !currentJobId) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground/50">
        <div className="text-center">
          <div className="text-4xl mb-2 opacity-50">⚡</div>
          No Active Mission
        </div>
      </div>
    );
  }

  const { job, steps, current_step, current_step_attempts, recent_logs } = uiState;

  if (job.status === 'READY') return <StartExecutionView jobId={currentJobId} />;
  if (job.status === 'PAUSED')
    return (
      <PausedView
        jobId={currentJobId}
        jobTitle={job.title}
        currentStep={current_step}
        attempts={current_step_attempts}
      />
    );
  if (job.status === 'COMPLETE') return <CompletedView jobTitle={job.title} steps={steps} />;
  if (job.status === 'FAILED') return <FailedView jobTitle={job.title} failureReason={job.failure_reason} />;

  return (
    <div className="h-full grid grid-cols-12 gap-4 p-4 font-sans text-sm">
      {/* Left: Tactical Timeline */}
      <div className="col-span-3 glass-panel p-4 flex flex-col overflow-hidden shadow-xl">
        <div className="flex items-center gap-2 mb-4 px-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
          <h2 className="font-bold tracking-tight text-white/90">Mission Timeline</h2>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
          <StepTimeline steps={steps} currentStepId={current_step?.step_id} />
        </div>
      </div>

      {/* Center: Glass Box */}
      <div className="col-span-6 flex flex-col gap-4 min-h-0">
        {current_step ? (
          <GlassBoxPanel step={current_step} attempts={current_step_attempts} jobId={currentJobId} />
        ) : (
          <div className="flex-1 glass-panel flex items-center justify-center">
            <span className="text-white/30 animate-pulse">Waiting for assignment...</span>
          </div>
        )}
      </div>

      {/* Right: Live Telemetry */}
      <div className="col-span-3 glass-panel p-4 flex flex-col overflow-hidden shadow-xl">
        <div className="flex items-center gap-2 mb-4 px-2">
          <CommandLineIcon className="w-4 h-4 text-primary" />
          <h2 className="font-bold tracking-tight text-white/90">Live Telemetry</h2>
        </div>
        <ActivityLogPanel logs={recent_logs} />
      </div>
    </div>
  );
}

// =============================================================================
// Status Views
// =============================================================================

function StartExecutionView({ jobId }: { jobId: string }) {
  const startMutation = useStartJob(jobId);

  return (
    <div className="flex h-full items-center justify-center text-center">
      <div className="glass-panel p-12 max-w-md animate-fade-in">
        <div className="text-6xl mb-6 opacity-80">🚀</div>
        <h2 className="text-2xl font-bold mb-3 tracking-tight">Mission Ready</h2>
        <p className="text-muted-foreground mb-8 leading-relaxed">
          All planning protocols complete. Authorize mission execution to proceed.
        </p>
        <button
          onClick={() => startMutation.mutate()}
          disabled={startMutation.isPending}
          className="w-full btn btn-primary py-4 text-lg font-bold shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all active:scale-95"
        >
          {startMutation.isPending ? 'Initiating Sequence...' : 'INITIALIZE EXECUTION'}
        </button>
      </div>
    </div>
  );
}

function PausedView({
  jobId,
  jobTitle,
  currentStep,
  attempts,
}: {
  jobId: string;
  jobTitle: string;
  currentStep: any;
  attempts: any[];
}) {
  const resumeMutation = useResumeJob(jobId);
  const latestAttempt = attempts?.[0];

  return (
    <div className="flex h-full items-center justify-center">
      <div className="glass-panel p-8 max-w-md w-full animate-fade-in border-yellow-500/20 shadow-[0_0_20px_rgba(234,179,8,0.1)]">
        <div className="text-center">
          <div className="inline-flex p-3 rounded-full bg-yellow-500/20 text-yellow-500 mb-4">
            <PauseIcon className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold mb-1">Execution Halted</h2>
          <p className="text-sm text-yellow-500/80 mb-6 font-mono">{jobTitle}</p>
        </div>

        {currentStep && latestAttempt?.outcome === 'rejected' && (
          <div className="mb-6 bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-sm">
            <div className="flex items-center gap-2 text-red-400 font-bold mb-2">
              <XCircleIcon className="w-5 h-5" />
              LAST REJECTION
            </div>
            {latestAttempt?.missing_fields?.length > 0 && (
              <div className="text-xs mb-2">
                <span className="text-muted-foreground">Missing:</span>{' '}
                <span className="text-red-300 font-mono">
                  {latestAttempt.missing_fields.join(', ')}
                </span>
              </div>
            )}
            {latestAttempt?.rejection_reasons?.length > 0 && (
              <ul className="list-disc list-inside text-muted-foreground space-y-1 pl-1">
                {latestAttempt.rejection_reasons.map((r: string, i: number) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <button
          onClick={() => resumeMutation.mutate()}
          disabled={resumeMutation.isPending}
          className="w-full btn btn-primary active:scale-95"
        >
          {resumeMutation.isPending ? 'Resuming...' : 'Resume Mission'}
        </button>
      </div>
    </div>
  );
}

function CompletedView({ jobTitle, steps }: { jobTitle: string; steps: any[] }) {
  const passedCount = steps.filter((s) => s.status === 'DONE').length;
  const failedCount = steps.filter((s) => s.status === 'FAILED').length;

  return (
    <div className="flex h-full items-center justify-center">
      <div className="glass-panel p-12 text-center animate-fade-in border-green-500/20 shadow-[0_0_30px_rgba(34,197,94,0.1)]">
        <div className="inline-flex p-4 rounded-full bg-green-500/20 text-green-500 mb-6">
          <CheckCircleIcon className="w-12 h-12" />
        </div>
        <h2 className="text-3xl font-bold mb-2">Mission Accomplished</h2>
        <p className="text-muted-foreground mb-8">{jobTitle}</p>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-green-500/10 rounded-xl border border-green-500/20">
            <div className="text-3xl font-bold text-green-500 mb-1">{passedCount}</div>
            <div className="text-xs uppercase tracking-wider text-green-500/60 font-bold">
              Successes
            </div>
          </div>
          <div className="p-4 bg-red-500/10 rounded-xl border border-red-500/20">
            <div className="text-3xl font-bold text-red-500 mb-1">{failedCount}</div>
            <div className="text-xs uppercase tracking-wider text-red-500/60 font-bold">
              Failures
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FailedView({ jobTitle, failureReason }: { jobTitle: string; failureReason?: string | null }) {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="glass-panel p-12 text-center animate-fade-in border-red-500/20 shadow-[0_0_30px_rgba(239,68,68,0.1)]">
        <div className="inline-flex p-4 rounded-full bg-red-500/20 text-red-500 mb-6">
          <XCircleIcon className="w-12 h-12" />
        </div>
        <h2 className="text-3xl font-bold mb-2 text-red-500">Mission Failed</h2>
        <p className="text-muted-foreground mb-6">{jobTitle}</p>
        {failureReason && (
          <div className="max-w-md p-4 bg-black/40 rounded-lg border border-red-500/30 font-mono text-sm text-red-300">
            {failureReason}
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Timeline
// =============================================================================

function StepTimeline({ steps, currentStepId }: { steps: any[]; currentStepId?: string }) {
  return (
    <div className="relative space-y-0 pl-4 py-2 border-l border-white/5 ml-2">
      {steps.map((step, index) => {
        const isCurrent = step.step_id === currentStepId;
        const isDone = step.status === 'DONE';
        const isFailed = step.status === 'FAILED';

        return (
          <div key={step.step_id} className="relative pl-6 pb-6 last:pb-0 group">
            <div
              className={cn(
                'absolute left-[-21px] top-0 w-4 h-4 rounded-full border-2 bg-background transition-all duration-300 flex items-center justify-center pt-[1px]',
                isCurrent
                  ? 'border-primary bg-primary shadow-[0_0_10px_rgba(59,130,246,0.6)] scale-110 z-10'
                  : isDone
                    ? 'border-green-500 bg-green-900/50'
                    : isFailed
                      ? 'border-red-500 bg-red-900/50'
                      : 'border-white/10 bg-black/50'
              )}
            >
              {isDone && <CheckCircleIcon className="w-3 h-3 text-green-500" />}
              {isFailed && <XCircleIcon className="w-3 h-3 text-red-500" />}
              {isCurrent && <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />}
            </div>

            <div
              className={cn(
                'p-3 rounded-lg border transition-all duration-200 cursor-default',
                isCurrent
                  ? 'bg-primary/10 border-primary/30 shadow-lg shadow-[0_0_15px_rgba(59,130,246,0.15)]'
                  : 'bg-white/5 border-white/5 hover:bg-white/10 opacity-70 hover:opacity-100'
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className={cn(
                    'text-xs font-bold uppercase tracking-wider',
                    isCurrent ? 'text-primary' : 'text-muted-foreground'
                  )}
                >
                  Step {index + 1}
                </span>
                {step.attempt_count > 0 && (
                  <span className="text-[10px] bg-black/40 px-1.5 py-0.5 rounded text-muted-foreground">
                    {step.attempt_count} tries
                  </span>
                )}
              </div>
              <div className={cn('text-sm font-medium leading-tight', isCurrent ? 'text-white' : 'text-muted-foreground')}>
                {step.title}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// =============================================================================
// Glass Box
// =============================================================================

function GlassBoxPanel({ step, attempts, jobId }: { step: any; attempts: any[]; jobId: string }) {
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const { data: stepPrompt } = useStepPrompt(jobId, step?.step_id ?? null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (stepPrompt && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [stepPrompt]);

  const attemptNumber = useMemo(() => (attempts?.length || 0) + 1, [attempts?.length]);

  return (
    <div className="flex flex-col h-full gap-4 min-h-0">
      <div className="glass-panel p-3 flex items-center justify-between bg-primary/5 border-primary/20 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
            <PlayIcon className="w-4 h-4 ml-0.5" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-none">{step.title}</h1>
            <p className="text-xs text-primary/70 font-mono mt-1 uppercase tracking-wide">
              EXECUTING ATTEMPT #{attemptNumber}
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowSubmitForm((v) => !v)}
          className={cn(
            'btn px-4 py-2 font-bold transition-all shadow-lg active:scale-95',
            showSubmitForm ? 'bg-white/10 hover:bg-white/20' : 'btn-primary hover:shadow-primary/40'
          )}
        >
          {showSubmitForm ? (
            <span className="flex items-center gap-2">
              <ArrowPathIcon className="w-4 h-4" /> REVIEW INPUTS
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <BeakerIcon className="w-4 h-4" /> REPORT RESULTS
            </span>
          )}
        </button>
      </div>

      {showSubmitForm ? (
        <div className="flex-1 glass-panel overflow-hidden animate-fade-in relative flex flex-col min-h-0">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-purple-500" />
          <div className="p-4 bg-black/20 border-b border-white/5">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <BeakerIcon className="w-5 h-5 text-purple-400" />
              Verification Lab
            </h3>
            <p className="text-sm text-muted-foreground">Submit evidence to verify this step&apos;s completion.</p>
          </div>
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            <SubmitResultForm
              jobId={jobId}
              stepId={step.step_id}
              stepPrompt={stepPrompt}
              onClose={() => setShowSubmitForm(false)}
            />
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 grid grid-rows-2 gap-4 animate-fade-in">
          <div className="glass-panel p-4 flex flex-col overflow-hidden min-h-0" ref={scrollRef}>
            <div className="flex items-center justify-between mb-2 shrink-0">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <CommandLineIcon className="w-3 h-3" /> System Instruction
              </h3>
              <button
                onClick={() => navigator.clipboard.writeText(step.instruction_prompt ?? '')}
                className="text-[10px] bg-white/5 hover:bg-white/10 px-2 py-1 rounded transition-colors"
              >
                COPY
              </button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar bg-black/20 rounded-lg p-3 border border-white/5 font-mono text-sm leading-relaxed text-white/90 whitespace-pre-wrap">
              {step.instruction_prompt}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 min-h-0">
            <div className="glass-panel p-4 flex flex-col overflow-hidden min-h-0">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 shrink-0 flex items-center gap-2">
                <CheckCircleIcon className="w-3 h-3" /> Acceptance Gates
              </h3>
              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
                {(step.acceptance_criteria || []).length === 0 ? (
                  <div className="text-xs text-muted-foreground/60 font-mono bg-black/20 border border-white/5 rounded-lg p-3">
                    No acceptance criteria for this step.
                  </div>
                ) : (
                  step.acceptance_criteria?.map((c: string, i: number) => (
                    <div
                      key={i}
                      className="flex gap-3 text-sm group p-2 rounded hover:bg-white/5 transition-colors"
                    >
                      <div className="w-4 h-4 rounded border border-white/20 flex items-center justify-center shrink-0 group-hover:border-primary/50">
                        <div className="w-2 h-2 rounded-[1px] bg-transparent group-hover:bg-primary transition-colors" />
                      </div>
                      <span className="text-muted-foreground group-hover:text-white transition-colors leading-snug">
                        {c}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="glass-panel p-4 flex flex-col overflow-hidden min-h-0">
              <div className="flex items-center justify-between mb-3 shrink-0">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Payload Preview</h3>
                {stepPrompt?.prompt && (
                  <button
                    onClick={() => navigator.clipboard.writeText(stepPrompt.prompt)}
                    className="text-[10px] text-primary hover:text-primary-foreground transition-colors"
                  >
                    COPY FULL
                  </button>
                )}
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar bg-black/40 rounded-lg p-2 border border-white/5 font-mono text-[10px] text-muted-foreground/70 whitespace-pre-wrap">
                {stepPrompt?.prompt || 'Loading prompt...'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SubmitResultForm({
  jobId,
  stepId,
  stepPrompt,
  onClose,
}: {
  jobId: string;
  stepId: string;
  stepPrompt: any;
  onClose: () => void;
}) {
  const [claim, setClaim] = useState<'MET' | 'NOT_MET' | 'PARTIAL'>('MET');
  const [summary, setSummary] = useState('');
  const [evidence, setEvidence] = useState('');
  const [devlogLine, setDevlogLine] = useState('');
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'FORM' | 'JSON'>('FORM');

  const submitMutation = useSubmitStepResult(jobId);

  useEffect(() => {
    if (!stepPrompt?.required_evidence_template) return;
    if (evidence.trim()) return;
    setEvidence(JSON.stringify(stepPrompt.required_evidence_template, null, 2) + '\n');
  }, [stepPrompt?.required_evidence_template, evidence]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!summary.trim()) return;

    let parsedEvidence: Record<string, unknown> = {};
    const rawEvidence = evidence.trim();
    if (rawEvidence) {
      try {
        parsedEvidence = JSON.parse(rawEvidence) as Record<string, unknown>;
      } catch (error) {
        setEvidenceError(
          error instanceof Error ? `Evidence must be valid JSON: ${error.message}` : 'Evidence must be valid JSON'
        );
        return;
      }
    }
    setEvidenceError(null);

    await submitMutation.mutateAsync({
      stepId,
      modelClaim: claim,
      summary: summary.trim(),
      evidence: parsedEvidence,
      devlogLine: devlogLine.trim() || undefined,
    });

    onClose();
  };

  const handleFormChange = (newObj: any) => {
    setEvidence(JSON.stringify(newObj, null, 2));
  };

  let parsedObj: any = {};
  try {
    parsedObj = JSON.parse(evidence || '{}');
  } catch {
    // ignore
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Verification Verdict</label>
        <div className="grid grid-cols-3 gap-3">
          {(['MET', 'PARTIAL', 'NOT_MET'] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setClaim(c)}
              className={cn(
                'py-3 rounded-lg border text-xs font-bold transition-all shadow-sm active:scale-95',
                claim === c
                  ? c === 'MET'
                    ? 'bg-green-500/20 border-green-500 text-green-500'
                    : c === 'PARTIAL'
                      ? 'bg-yellow-500/20 border-yellow-500 text-yellow-500'
                      : 'bg-red-500/20 border-red-500 text-red-500'
                  : 'bg-black/20 border-white/5 hover:bg-white/5 hover:border-white/10'
              )}
            >
              {c === 'MET' && '✅ SUCCESS'}
              {c === 'PARTIAL' && '⚠️ PARTIAL'}
              {c === 'NOT_MET' && '❌ FAILED'}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Execution Summary</label>
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={3}
          placeholder="Briefly describe what was accomplished in this step..."
          className="w-full rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all resize-none placeholder:text-muted-foreground/30"
          required
        />
      </div>

      <div className="space-y-2">
        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Devlog Note <span className="text-muted-foreground/60">(optional)</span>
        </label>
        <input
          value={devlogLine}
          onChange={(e) => setDevlogLine(e.target.value)}
          placeholder="Short note for the devlog..."
          className="w-full rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-muted-foreground/30"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Evidence Data</label>
          <div className="flex bg-black/20 rounded p-0.5 border border-white/5">
            <button
              type="button"
              onClick={() => setViewMode('FORM')}
              className={cn(
                'px-3 py-1 text-[10px] font-bold rounded transition-all',
                viewMode === 'FORM' ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:text-white'
              )}
            >
              FORM
            </button>
            <button
              type="button"
              onClick={() => setViewMode('JSON')}
              className={cn(
                'px-3 py-1 text-[10px] font-bold rounded transition-all',
                viewMode === 'JSON' ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:text-white'
              )}
            >
              JSON
            </button>
          </div>
        </div>

        <div className="glass-panel p-3 bg-black/20 border-white/5">
          {viewMode === 'FORM' ? (
            <DynamicEvidenceForm value={parsedObj} onChange={handleFormChange} />
          ) : (
            <>
              <p className="text-xs text-muted-foreground mb-2">
                Paste the EvidenceSchema JSON object here.
              </p>
              <textarea
                value={evidence}
                onChange={(e) => setEvidence(e.target.value)}
                rows={6}
                placeholder="Paste EvidenceSchema JSON..."
                className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none placeholder:text-muted-foreground/30"
              />
              {evidenceError && <p className="text-sm text-red-400 mt-2">{evidenceError}</p>}
            </>
          )}
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onClose} className="btn btn-outline flex-1 active:scale-95">
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitMutation.isPending || !summary.trim()}
          className="btn btn-primary flex-1 active:scale-95"
        >
          {submitMutation.isPending ? 'Submitting...' : 'Submit'}
        </button>
      </div>
    </form>
  );
}

function DynamicEvidenceForm({
  value,
  onChange,
  path = [],
}: {
  value: any;
  onChange: (val: any) => void;
  path?: string[];
}) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground italic">null</span>;
  }

  if (typeof value === 'boolean') {
    return (
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={value}
          onChange={(e) => onChange(e.target.checked)}
          className="rounded border-white/20 bg-black/20"
        />
        <span className="text-sm">{path[path.length - 1] || 'Value'}</span>
      </div>
    );
  }

  if (typeof value === 'string') {
    return (
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
      />
    );
  }

  if (typeof value === 'number') {
    return (
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
      />
    );
  }

  if (Array.isArray(value)) {
    const isStringArray = value.every((item) => typeof item === 'string');

    return (
      <div className="space-y-2">
        {value.map((item, i) => (
          <div key={i} className="flex gap-2">
            <div className="flex-1">
              <DynamicEvidenceForm
                value={item}
                path={[...path, String(i)]}
                onChange={(newVal) => {
                  const newArr = [...value];
                  newArr[i] = newVal;
                  onChange(newArr);
                }}
              />
            </div>
            <button
              type="button"
              onClick={() => onChange(value.filter((_, idx) => idx !== i))}
              className="text-muted-foreground hover:text-destructive p-1"
              title="Remove item"
            >
              <XCircleIcon className="h-4 w-4" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange([...value, isStringArray ? '' : {}])}
          className="text-xs flex items-center gap-1 text-primary hover:underline"
        >
          <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-primary/20">
            +
          </span>
          Add Item
        </button>
      </div>
    );
  }

  if (typeof value === 'object') {
    return (
      <div className="space-y-4 pl-3 border-l-2 border-primary/20">
        {Object.entries(value).map(([key, val]) => (
          <div key={key}>
            <label className="block text-[10px] font-bold text-muted-foreground mb-1.5 uppercase tracking-wider">
              {key.replace(/_/g, ' ')}
            </label>
            <DynamicEvidenceForm
              value={val}
              path={[...path, key]}
              onChange={(newVal) => onChange({ ...value, [key]: newVal })}
            />
          </div>
        ))}
      </div>
    );
  }

  return <div>Unknown Type</div>;
}

function ActivityLogPanel({ logs }: { logs: any[] }) {
  const [filter, setFilter] = useState('');

  const filteredLogs = useMemo(() => {
    if (!filter) return logs;
    const q = filter.toLowerCase();
    return logs?.filter(l =>
      l.content?.toLowerCase().includes(q) ||
      formatDate(l.created_at).toLowerCase().includes(q)
    );
  }, [logs, filter]);

  return (
    <div className="flex flex-col h-full uppercase">
      <div className="mb-3">
        <input
          type="text"
          placeholder="Filter logs..."
          className="w-full bg-black/40 border border-white/5 rounded-md px-3 py-1.5 text-[10px] font-mono focus:ring-1 focus:ring-primary/40 focus:outline-none transition-all"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>
      <div className="flex-1 overflow-auto space-y-3 mb-4 custom-scrollbar pr-2">
        {filteredLogs?.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8 opacity-50">
            {filter ? 'No matching logs' : 'Awaiting telemetry data...'}
          </p>
        ) : (
          filteredLogs?.map((log, i) => (
            <div
              key={i}
              className="p-2.5 rounded-lg bg-white/5 border border-white/5 text-xs font-mono leading-relaxed group hover:bg-white/[0.07] transition-colors"
            >
              <div className="text-[10px] text-primary/70 mb-1 opacity-70 group-hover:opacity-100 transition-opacity">
                {formatDate(log.created_at)}
              </div>
              <p className="text-gray-300 whitespace-pre-wrap">{log.content}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

