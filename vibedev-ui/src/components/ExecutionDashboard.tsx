// =============================================================================
// Execution Dashboard Component - Active Step & Evidence Viewer
// =============================================================================

import { useEffect, useState } from 'react';
import { useVibeDevStore } from '@/stores/useVibeDevStore';
import {
  useStartJob,
  useResumeJob,
  useSubmitStepResult,
  useAppendDevlog,
  useStepPrompt,
} from '@/hooks/useUIState';
import { cn, formatDate } from '@/lib/utils';

export function ExecutionDashboard() {
  const uiState = useVibeDevStore((state) => state.uiState);
  const currentJobId = useVibeDevStore((state) => state.currentJobId);

  if (!uiState || !currentJobId) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">No job selected</p>
      </div>
    );
  }

  const { job, steps, current_step, current_step_attempts, recent_logs } = uiState;

  // Handle READY state - needs to be started
  if (job.status === 'READY') {
    return <StartExecutionView jobId={currentJobId} />;
  }

  // Handle PAUSED state
  if (job.status === 'PAUSED') {
    return (
      <PausedView
        jobId={currentJobId}
        job={job}
        currentStep={current_step}
        attempts={current_step_attempts}
      />
    );
  }

  // Handle COMPLETE state
  if (job.status === 'COMPLETE') {
    return <CompletedView job={job} steps={steps} />;
  }

  // Handle FAILED state
  if (job.status === 'FAILED') {
    return <FailedView job={job} />;
  }

  return (
    <div className="h-full flex">
      {/* Left: Step Progress */}
      <div className="w-80 border-r overflow-auto">
        <StepProgressPanel steps={steps} currentStepId={current_step?.step_id} />
      </div>

      {/* Center: Active Step */}
      <div className="flex-1 overflow-auto p-6">
        {current_step ? (
          <ActiveStepPanel
            step={current_step}
            attempts={current_step_attempts}
            jobId={currentJobId}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <div className="text-4xl mb-2">🎉</div>
              <p className="text-lg font-medium">All steps complete!</p>
              <p className="text-muted-foreground">
                The job has been successfully executed.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Right: Activity Log */}
      <div className="w-80 border-l overflow-auto">
        <ActivityLogPanel logs={recent_logs} jobId={currentJobId} />
      </div>
    </div>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

function StartExecutionView({ jobId }: { jobId: string }) {
  const startMutation = useStartJob(jobId);

  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <div className="text-6xl mb-4">🚀</div>
        <h2 className="text-xl font-semibold mb-2">Ready to Execute</h2>
        <p className="text-muted-foreground mb-6">
          The planning phase is complete. Start execution to begin working through the steps.
        </p>
        <button
          onClick={() => startMutation.mutate()}
          disabled={startMutation.isPending}
          className="btn btn-primary text-lg px-8 py-3"
        >
          {startMutation.isPending ? 'Starting...' : 'Start Execution'}
        </button>
      </div>
    </div>
  );
}

function PausedView({
  jobId,
  job,
  currentStep,
  attempts,
}: {
  jobId: string;
  job: any;
  currentStep: any;
  attempts: any[];
}) {
  const resumeMutation = useResumeJob(jobId);
  const latestAttempt = attempts?.[0];

  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <div className="text-6xl mb-4">⏸️</div>
        <h2 className="text-xl font-semibold mb-2">Execution Paused</h2>
        <p className="text-muted-foreground mb-6">
          {job.title} is currently paused.
        </p>
        {currentStep && (
          <div className="mb-6 text-sm">
            <div className="font-medium">
              Paused on {currentStep.step_id}: {currentStep.title}
            </div>
            {latestAttempt?.outcome === 'rejected' &&
              (latestAttempt?.rejection_reasons?.length > 0 ||
                latestAttempt?.missing_fields?.length > 0) && (
                <div className="mt-3 text-left max-w-xl mx-auto rounded border bg-muted p-3">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Last Rejection
                  </div>
                  {latestAttempt?.missing_fields?.length > 0 && (
                    <div className="text-xs mb-2">
                      <span className="font-medium">Missing:</span>{' '}
                      {latestAttempt.missing_fields.join(', ')}
                    </div>
                  )}
                  {latestAttempt?.rejection_reasons?.length > 0 && (
                    <ul className="list-disc list-inside text-xs space-y-1">
                      {latestAttempt.rejection_reasons.map((r: string, i: number) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
          </div>
        )}
        <button
          onClick={() => resumeMutation.mutate()}
          disabled={resumeMutation.isPending}
          className="btn btn-primary"
        >
          {resumeMutation.isPending ? 'Resuming...' : 'Resume Execution'}
        </button>
      </div>
    </div>
  );
}

function CompletedView({ job, steps }: { job: any; steps: any[] }) {
  const passedCount = steps.filter((s) => s.status === 'DONE').length;
  const failedCount = steps.filter((s) => s.status === 'FAILED').length;

  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <div className="text-6xl mb-4">✅</div>
        <h2 className="text-xl font-semibold mb-2">Job Completed</h2>
        <p className="text-muted-foreground mb-4">{job.title}</p>
        <div className="flex gap-6 justify-center">
          <div>
            <div className="text-2xl font-bold text-green-600">{passedCount}</div>
            <div className="text-sm text-muted-foreground">Done</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-red-600">{failedCount}</div>
            <div className="text-sm text-muted-foreground">Failed</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FailedView({ job }: { job: any }) {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <div className="text-6xl mb-4">❌</div>
        <h2 className="text-xl font-semibold mb-2">Job Failed</h2>
        <p className="text-muted-foreground mb-4">{job.title}</p>
        {job.failure_reason && (
          <div className="max-w-md mx-auto p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
            <p className="text-red-800 dark:text-red-200">{job.failure_reason}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function StepProgressPanel({
  steps,
  currentStepId,
}: {
  steps: any[];
  currentStepId?: string;
}) {
  return (
    <div className="p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
        Step Progress
      </h3>
      <div className="space-y-2">
        {steps.map((step, index) => {
          const isCurrent = step.step_id === currentStepId;

          return (
            <div
              key={step.step_id}
              className={cn(
                'p-3 rounded-lg border transition-all',
                isCurrent && 'border-blue-300 bg-blue-50 dark:bg-blue-900/20 pulse-active',
                !isCurrent && 'border-transparent hover:bg-accent'
              )}
            >
              <div className="flex items-center gap-2">
                <StepStatusIcon status={step.status} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{index + 1}.</span>
                    <span className={cn('text-sm truncate', isCurrent && 'font-medium')}>
                      {step.title}
                    </span>
                  </div>
                  {step.attempt_count > 0 && (
                    <div className="text-xs text-muted-foreground">
                      {step.attempt_count} attempt{step.attempt_count !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StepStatusIcon({ status }: { status: string }) {
  if (status === 'DONE') {
    return (
      <div className="h-6 w-6 rounded-full bg-green-500 flex items-center justify-center">
        <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
      </div>
    );
  }
  if (status === 'FAILED') {
    return (
      <div className="h-6 w-6 rounded-full bg-red-500 flex items-center justify-center">
        <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </div>
    );
  }
  if (status === 'ACTIVE') {
    return (
      <div className="h-6 w-6 rounded-full bg-blue-500 flex items-center justify-center">
        <div className="h-2 w-2 rounded-full bg-white animate-pulse" />
      </div>
    );
  }
  return (
    <div className="h-6 w-6 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
      <div className="h-2 w-2 rounded-full bg-gray-500 dark:bg-gray-400" />
    </div>
  );
}

function ActiveStepPanel({
  step,
  attempts,
  jobId,
}: {
  step: any;
  attempts: any[];
  jobId: string;
}) {
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const { data: stepPrompt } = useStepPrompt(jobId, step?.step_id ?? null);

  return (
    <div className="space-y-6">
      {/* Step Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
          <span>Current Step</span>
          <span>•</span>
          <span>Attempt #{(attempts?.length || 0) + 1}</span>
        </div>
        <h1 className="text-2xl font-bold">{step.title}</h1>
      </div>

      {/* Instruction */}
      <div className="panel">
        <div className="panel-header">
          <h3 className="panel-title">Instruction Prompt</h3>
          <button
            onClick={() => navigator.clipboard.writeText(step.instruction_prompt)}
            className="btn btn-ghost btn-icon"
            title="Copy to clipboard"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
          </button>
        </div>
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <p className="whitespace-pre-wrap">{step.instruction_prompt}</p>
        </div>
      </div>

      {/* Step Prompt Preview (Full) */}
      {stepPrompt?.prompt && (
        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">Step Prompt (Copy/Paste)</h3>
            <button
              onClick={() => navigator.clipboard.writeText(stepPrompt.prompt)}
              className="btn btn-ghost btn-icon"
              title="Copy step prompt"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            </button>
          </div>
          <pre className="text-xs whitespace-pre-wrap font-mono bg-muted/50 rounded-lg p-3 overflow-auto">
            {stepPrompt.prompt}
          </pre>
        </div>
      )}

      {/* Acceptance Criteria */}
      {step.acceptance_criteria?.length > 0 && (
        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">Acceptance Criteria</h3>
          </div>
          <ul className="space-y-2">
            {step.acceptance_criteria.map((c: string, i: number) => (
              <li key={i} className="flex items-start gap-2">
                <input type="checkbox" className="mt-1 rounded" />
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Required Evidence */}
      {step.required_evidence?.length > 0 && (
        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">Required Evidence</h3>
          </div>
          <ul className="space-y-2">
            {step.required_evidence.map((e: string, i: number) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-muted-foreground">•</span>
                <span>{e}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Previous Attempts */}
      {attempts?.length > 0 && (
        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">Previous Attempts</h3>
          </div>
          <div className="space-y-3">
            {attempts.map((attempt, i) => (
              <div
                key={attempt.attempt_id}
                className={cn(
                  'p-3 rounded-lg border',
                  attempt.outcome === 'accepted' &&
                  'bg-green-50 border-green-200 dark:bg-green-900/20',
                  attempt.outcome === 'rejected' &&
                  'bg-red-50 border-red-200 dark:bg-red-900/20'
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Attempt {i + 1}</span>
                  <span
                    className={cn(
                      'text-xs px-2 py-0.5 rounded-full',
                      attempt.outcome === 'accepted' &&
                      'bg-green-200 text-green-800',
                      attempt.outcome === 'rejected' && 'bg-red-200 text-red-800'
                    )}
                  >
                    {attempt.model_claim} / {attempt.outcome}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{attempt.summary}</p>
                {(attempt.missing_fields?.length > 0 ||
                  attempt.rejection_reasons?.length > 0) && (
                    <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                      {attempt.missing_fields?.length > 0 && (
                        <div>Missing: {attempt.missing_fields.join(', ')}</div>
                      )}
                      {attempt.rejection_reasons?.length > 0 && (
                        <div>Reasons: {attempt.rejection_reasons.join(' | ')}</div>
                      )}
                    </div>
                  )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Submit Result Button */}
      <div className="flex gap-3">
        <button
          onClick={() => setShowSubmitForm(!showSubmitForm)}
          className="btn btn-primary"
        >
          {showSubmitForm ? 'Cancel' : 'Submit Result'}
        </button>
      </div>

      {/* Submit Form */}
      {showSubmitForm && (
        <SubmitResultForm
          jobId={jobId}
          stepId={step.step_id}
          stepPrompt={stepPrompt}
          onClose={() => setShowSubmitForm(false)}
        />
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!summary.trim()) return;

    let parsedEvidence: Record<string, unknown> = {};
    const rawEvidence = evidence.trim();
    if (rawEvidence) {
      try {
        parsedEvidence = JSON.parse(rawEvidence) as Record<string, unknown>;
      } catch (error) {
        setEvidenceError(
          error instanceof Error
            ? `Evidence must be valid JSON: ${error.message}`
            : 'Evidence must be valid JSON'
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
  } catch (e) {
    // ignore
  }

  return (
    <form onSubmit={handleSubmit} className="panel animate-fade-in">
      <div className="panel-header">
        <h3 className="panel-title">Submit Step Result</h3>
      </div>

      <div className="space-y-4">
        {/* Claim Selection */}
        <div>
          <label className="block text-sm font-medium mb-2">Verdict</label>
          <div className="flex gap-3">
            {(['MET', 'PARTIAL', 'NOT_MET'] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setClaim(c)}
                className={cn(
                  'flex-1 py-2 rounded-md border text-sm font-medium transition-colors',
                  claim === c
                    ? c === 'MET'
                      ? 'bg-green-500 text-white border-green-500'
                      : c === 'PARTIAL'
                        ? 'bg-yellow-500 text-white border-yellow-500'
                        : 'bg-red-500 text-white border-red-500'
                    : 'bg-background hover:bg-accent'
                )}
              >
                {c.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div>
          <label className="block text-sm font-medium mb-1">Summary</label>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={3}
            placeholder="Describe what was accomplished..."
            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            required
          />
        </div>

        {/* Evidence */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium">Evidence</label>
            <div className="flex border rounded overflow-hidden">
              <button
                type="button"
                onClick={() => setViewMode('FORM')}
                className={cn(
                  'px-3 py-1 text-xs',
                  viewMode === 'FORM' ? 'bg-primary text-white' : 'bg-muted hover:bg-muted/80'
                )}
              >
                Form
              </button>
              <button
                type="button"
                onClick={() => setViewMode('JSON')}
                className={cn(
                  'px-3 py-1 text-xs',
                  viewMode === 'JSON' ? 'bg-primary text-white' : 'bg-muted hover:bg-muted/80'
                )}
              >
                JSON
              </button>
            </div>
          </div>

          {viewMode === 'FORM' ? (
            <div className="border rounded-md p-4 bg-muted/10 space-y-4">
              <DynamicEvidenceForm value={parsedObj} onChange={handleFormChange} />
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground mb-2">
                Paste the EvidenceSchema JSON object here.
              </p>
              <textarea
                value={evidence}
                onChange={(e) => setEvidence(e.target.value)}
                rows={4}
                placeholder="Paste EvidenceSchema JSON..."
                className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
              {evidenceError && (
                <p className="text-sm text-red-600 mt-2">{evidenceError}</p>
              )}
            </>
          )}
        </div>

        {/* Devlog */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Devlog Note <span className="text-muted-foreground">(optional)</span>
          </label>
          <input
            type="text"
            value={devlogLine}
            onChange={(e) => setDevlogLine(e.target.value)}
            placeholder="Brief note for the development log..."
            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn btn-outline flex-1">
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitMutation.isPending || !summary.trim()}
            className="btn btn-primary flex-1"
          >
            {submitMutation.isPending ? 'Submitting...' : 'Submit'}
          </button>
        </div>
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
          className="rounded border-gray-300"
        />
        <span className="text-sm">{path[path.length - 1] || 'Value'}</span>
      </div>
    );
  }

  if (typeof value === 'string') {
    // If key contains "checklist" or "files", maybe suggest lines?
    // For now simple text input
    return (
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
    );
  }

  if (typeof value === 'number') {
    return (
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange([...value, isStringArray ? '' : {}])}
          className="text-xs flex items-center gap-1 text-primary hover:underline"
        >
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Item
        </button>
      </div>
    );
  }

  if (typeof value === 'object') {
    return (
      <div className="space-y-3 pl-2 border-l-2 border-muted">
        {Object.entries(value).map(([key, val]) => (
          <div key={key}>
            <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">
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

function ActivityLogPanel({ logs, jobId }: { logs: any[]; jobId: string }) {
  const [newLog, setNewLog] = useState('');
  const appendMutation = useAppendDevlog(jobId);

  const handleAddLog = async () => {
    if (!newLog.trim()) return;
    await appendMutation.mutateAsync({ content: newLog.trim() });
    setNewLog('');
  };

  return (
    <div className="p-4 flex flex-col h-full">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
        Activity Log
      </h3>

      {/* Log entries */}
      <div className="flex-1 overflow-auto space-y-2 mb-4">
        {logs?.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No activity yet
          </p>
        ) : (
          logs?.map((log, i) => (
            <div key={i} className="p-2 rounded bg-muted text-sm">
              <div className="text-xs text-muted-foreground mb-1">
                {formatDate(log.created_at)}
              </div>
              <p>{log.content}</p>
            </div>
          ))
        )}
      </div>

      {/* Add log input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newLog}
          onChange={(e) => setNewLog(e.target.value)}
          placeholder="Add a note..."
          className="flex-1 rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          onKeyDown={(e) => e.key === 'Enter' && handleAddLog()}
        />
        <button
          onClick={handleAddLog}
          disabled={appendMutation.isPending || !newLog.trim()}
          className="btn btn-primary btn-icon"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
