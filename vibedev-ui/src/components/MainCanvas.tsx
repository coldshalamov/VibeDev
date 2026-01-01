// =============================================================================
// Main Canvas Component - Planning Mode Step Editor
// =============================================================================

import { useState } from 'react';
import { useVibeDevStore } from '@/stores/useVibeDevStore';
import {
  useNextQuestions,
  useAnswerQuestions,
  useSetDeliverables,
  useSetInvariants,
  useSetDefinitionOfDone,
  useProposeSteps,
  useSetJobReady,
} from '@/hooks/useUIState';
import { cn } from '@/lib/utils';

export function MainCanvas() {
  const uiState = useVibeDevStore((state) => state.uiState);
  const currentJobId = useVibeDevStore((state) => state.currentJobId);

  if (!uiState || !currentJobId) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">No job selected</p>
      </div>
    );
  }

  const { phase, steps } = uiState;

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Phase-based content */}
        {!phase.is_complete ? (
          <PlanningInterviewSection jobId={currentJobId} phase={phase} />
        ) : steps.length === 0 ? (
          <StepCreationSection jobId={currentJobId} />
        ) : (
          <StepListSection steps={steps} jobId={currentJobId} />
        )}

        {/* Ready transition button */}
        {phase.is_complete && steps.length > 0 && (
          <ReadyTransitionSection jobId={currentJobId} uiState={uiState} />
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Planning Interview Section
// =============================================================================

function PlanningInterviewSection({
  jobId,
  phase,
}: {
  jobId: string;
  phase: any;
}) {
  const { data: questionsData, isLoading } = useNextQuestions(jobId);
  const answerMutation = useAnswerQuestions(jobId);
  const setDeliverablesMutation = useSetDeliverables(jobId);
  const setInvariantsMutation = useSetInvariants(jobId);
  const setDoDMutation = useSetDefinitionOfDone(jobId);

  const [answers, setAnswers] = useState<Record<string, string>>({});

  if (isLoading) {
    return (
      <div className="panel">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-muted rounded w-1/2" />
          <div className="h-20 bg-muted rounded" />
        </div>
      </div>
    );
  }

  const questions = questionsData?.questions || [];

  if (questions.length === 0) {
    return (
      <div className="panel text-center">
        <p className="text-muted-foreground">No pending questions</p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    for (const q of questions) {
      const answer = answers[q.key];
      if (!answer && q.required) continue;

      // Route to appropriate endpoint based on key
      if (q.key === 'deliverables') {
        const items = answer.split('\n').filter((s) => s.trim());
        await setDeliverablesMutation.mutateAsync(items);
      } else if (q.key === 'invariants') {
        const items = answer.split('\n').filter((s) => s.trim());
        await setInvariantsMutation.mutateAsync(items);
      } else if (q.key === 'definition_of_done') {
        const items = answer.split('\n').filter((s) => s.trim());
        await setDoDMutation.mutateAsync(items);
      } else {
        // Generic planning answer
        await answerMutation.mutateAsync({ [q.key]: answer || null });
      }
    }

    setAnswers({});
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <h3 className="panel-title">
          Phase {phase.current_phase}: {phase.current_phase_name.replace('_', ' ')}
        </h3>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {questions.map((q) => (
          <QuestionField
            key={q.key}
            question={q}
            value={answers[q.key] || ''}
            onChange={(val) => setAnswers({ ...answers, [q.key]: val })}
          />
        ))}

        <button
          type="submit"
          disabled={answerMutation.isPending}
          className="btn btn-primary"
        >
          {answerMutation.isPending ? 'Saving...' : 'Continue'}
        </button>
      </form>
    </div>
  );
}

function QuestionField({
  question,
  value,
  onChange,
}: {
  question: any;
  value: string;
  onChange: (val: string) => void;
}) {
  const isMultiline = ['deliverables', 'invariants', 'definition_of_done', 'out_of_scope'].includes(
    question.key
  );

  return (
    <div>
      <label className="block text-sm font-medium mb-1">
        {question.question}
        {!question.required && (
          <span className="text-muted-foreground ml-1">(optional)</span>
        )}
      </label>
      <p className="text-xs text-muted-foreground mb-2">{question.rationale}</p>
      {isMultiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          placeholder="Enter each item on a new line..."
          className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
        />
      ) : question.key === 'repo_exists' ? (
        <div className="flex gap-4">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={value === 'true'}
              onChange={() => onChange('true')}
              className="text-primary"
            />
            Yes
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={value === 'false'}
              onChange={() => onChange('false')}
              className="text-primary"
            />
            No (greenfield)
          </label>
        </div>
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      )}
    </div>
  );
}

// =============================================================================
// Step Creation Section
// =============================================================================

function StepCreationSection({ jobId }: { jobId: string }) {
  const [steps, setSteps] = useState<
    Array<{
      title: string;
      instruction_prompt: string;
      acceptance_criteria: string;
      required_evidence: string;
    }>
  >([{ title: '', instruction_prompt: '', acceptance_criteria: '', required_evidence: '' }]);

  const proposeStepsMutation = useProposeSteps(jobId);

  const addStep = () => {
    setSteps([
      ...steps,
      { title: '', instruction_prompt: '', acceptance_criteria: '', required_evidence: '' },
    ]);
  };

  const updateStep = (index: number, field: string, value: string) => {
    const newSteps = [...steps];
    (newSteps[index] as any)[field] = value;
    setSteps(newSteps);
  };

  const removeStep = (index: number) => {
    setSteps(steps.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    const validSteps = steps
      .filter((s) => s.title.trim() && s.instruction_prompt.trim())
      .map((s) => ({
        title: s.title.trim(),
        instruction_prompt: s.instruction_prompt.trim(),
        acceptance_criteria: s.acceptance_criteria
          .split('\n')
          .filter((x) => x.trim()),
        required_evidence: s.required_evidence
          .split('\n')
          .filter((x) => x.trim()),
      }));

    if (validSteps.length === 0) return;

    await proposeStepsMutation.mutateAsync(validSteps);
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <h3 className="panel-title">Define Execution Steps</h3>
        <button onClick={addStep} className="btn btn-outline btn-icon" title="Add step">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      <div className="space-y-4">
        {steps.map((step, index) => (
          <div key={index} className="p-4 border rounded-lg relative">
            <div className="absolute top-2 right-2 flex gap-1">
              <button
                onClick={() => removeStep(index)}
                className="text-muted-foreground hover:text-destructive p-1"
                title="Remove step"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="text-sm font-medium text-muted-foreground mb-2">
              Step {index + 1}
            </div>

            <div className="space-y-3">
              <input
                type="text"
                placeholder="Step title"
                value={step.title}
                onChange={(e) => updateStep(index, 'title', e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />

              <textarea
                placeholder="Instruction prompt (what the AI should do)"
                value={step.instruction_prompt}
                onChange={(e) => updateStep(index, 'instruction_prompt', e.target.value)}
                rows={3}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />

              <textarea
                placeholder="Acceptance criteria (one per line)"
                value={step.acceptance_criteria}
                onChange={(e) => updateStep(index, 'acceptance_criteria', e.target.value)}
                rows={2}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />

              <textarea
                placeholder="Required evidence (one per line)"
                value={step.required_evidence}
                onChange={(e) => updateStep(index, 'required_evidence', e.target.value)}
                rows={2}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={proposeStepsMutation.isPending}
          className="btn btn-primary"
        >
          {proposeStepsMutation.isPending ? 'Saving...' : 'Save Steps'}
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// Step List Section
// =============================================================================

function StepListSection({
  steps,
}: {
  steps: any[];
  jobId: string;
}) {
  const selectedStepIds = useVibeDevStore((state) => state.selectedStepIds);
  const toggleStepSelection = useVibeDevStore((state) => state.toggleStepSelection);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Execution Plan</h2>
        <span className="text-sm text-muted-foreground">
          {steps.length} steps
        </span>
      </div>

      <div className="space-y-3">
        {steps.map((step, index) => (
          <StepCard
            key={step.step_id}
            step={step}
            index={index}
            isSelected={selectedStepIds.includes(step.step_id)}
            onToggleSelect={() => toggleStepSelection(step.step_id)}
          />
        ))}
      </div>
    </div>
  );
}

function StepCard({
  step,
  index,
  isSelected,
  onToggleSelect,
}: {
  step: any;
  index: number;
  isSelected: boolean;
  onToggleSelect: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      className={cn(
        'step-card',
        `step-card-${step.status.toLowerCase()}`,
        isSelected && 'ring-2 ring-primary'
      )}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggleSelect}
          className="mt-1 rounded border-gray-300"
        />

        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">
              {index + 1}.
            </span>
            <h3 className="font-medium">{step.title}</h3>
            <span
              className={cn(
                'ml-auto px-2 py-0.5 text-xs rounded-full',
                step.status === 'DONE' && 'bg-green-100 text-green-800 dark:bg-green-900/30',
                step.status === 'FAILED' && 'bg-red-100 text-red-800 dark:bg-red-900/30',
                step.status === 'ACTIVE' && 'bg-blue-100 text-blue-800 dark:bg-blue-900/30',
                step.status === 'PENDING' && 'bg-gray-100 text-gray-800 dark:bg-gray-700/30'
              )}
            >
              {step.status}
            </span>
          </div>

          {step.attempt_count > 0 && (
            <div className="text-xs text-muted-foreground mt-1">
              {step.attempt_count} attempt{step.attempt_count !== 1 ? 's' : ''}
            </div>
          )}

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs text-primary hover:underline mt-2"
          >
            {isExpanded ? 'Hide details' : 'Show details'}
          </button>

          {isExpanded && (
            <div className="mt-3 space-y-3 text-sm animate-fade-in">
              {step.instruction_prompt && (
                <div>
                  <div className="font-medium text-muted-foreground mb-1">
                    Instruction
                  </div>
                  <p className="whitespace-pre-wrap">{step.instruction_prompt}</p>
                </div>
              )}

              {step.acceptance_criteria?.length > 0 && (
                <div>
                  <div className="font-medium text-muted-foreground mb-1">
                    Acceptance Criteria
                  </div>
                  <ul className="list-disc list-inside space-y-1">
                    {step.acceptance_criteria.map((c: string, i: number) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}

              {step.required_evidence?.length > 0 && (
                <div>
                  <div className="font-medium text-muted-foreground mb-1">
                    Required Evidence
                  </div>
                  <ul className="list-disc list-inside space-y-1">
                    {step.required_evidence.map((e: string, i: number) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Ready Transition Section
// =============================================================================

function ReadyTransitionSection({
  jobId,
  uiState,
}: {
  jobId: string;
  uiState: any;
}) {
  const setReadyMutation = useSetJobReady(jobId);

  const canTransition = uiState.job.status === 'PLANNING';

  if (!canTransition) {
    return null;
  }

  return (
    <div className="panel bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-green-800 dark:text-green-200">
            Ready to Execute?
          </h3>
          <p className="text-sm text-green-600 dark:text-green-400">
            All planning phases complete. Transition to execution mode.
          </p>
        </div>
        <button
          onClick={() => setReadyMutation.mutate()}
          disabled={setReadyMutation.isPending}
          className="btn bg-green-600 text-white hover:bg-green-700"
        >
          {setReadyMutation.isPending ? 'Transitioning...' : 'Mark as Ready'}
        </button>
      </div>
    </div>
  );
}
