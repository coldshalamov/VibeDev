// =============================================================================
// Horizontal Step Flow Editor
// =============================================================================
// A horizontal, left-to-right workflow editor with:
// - Main thread: Step1, Step2, Step3...
// - Sub-threads: Sub1, Sub2, Sub3... (for fail cases, merge back to main)
// - Conditions with modular, shareable scripts
// - "See Code" to view/edit condition logic

import { useState, useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
    PlusIcon,
    TrashIcon,
    ChevronDownIcon,
    CodeBracketIcon,
    XMarkIcon,
    ArrowRightIcon,
} from '@heroicons/react/24/outline';

// =============================================================================
// Types
// =============================================================================

export type StepType = 'PROMPT' | 'CONDITION' | 'BREAKPOINT';

export type Step = {
    id: string;
    type: StepType;
    label: string; // Step1, Step2, Sub1, Sub2, etc.
    title: string;
    // For PROMPT
    role?: string;
    context?: string;
    task?: string;
    guardrails?: string;
    deliverables?: string;
    // For CONDITION
    conditionType?: 'script' | 'llm';
    conditionCode?: string;
    conditionDescription?: string;
    onPass?: string; // ID of next step
    onFail?: string; // ID of sub-thread step
    // For BREAKPOINT
    reason?: string;
    carryForward?: string;
    // Navigation
    nextStep?: string; // Default next step ID
    isSubThread?: boolean; // Is this part of a sub-thread?
    subThreadLevel?: number; // 0 = main, 1 = sub level 1, etc.
};

export type Flow = {
    name: string;
    description: string;
    steps: Step[];
    globalContext: string;
};

// =============================================================================
// Helper Functions
// =============================================================================

function generateId() {
    return `step_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

function getNextLabel(steps: Step[], isSubThread: boolean): string {
    const prefix = isSubThread ? 'Sub' : 'Step';
    const existing = steps.filter(s => s.label.startsWith(prefix));
    const numbers = existing.map(s => parseInt(s.label.replace(prefix, '')) || 0);
    const next = Math.max(0, ...numbers) + 1;
    return `${prefix}${next}`;
}

// =============================================================================
// Step Card Component
// =============================================================================

function StepCard({
    step,
    allSteps,
    onChange,
    onDelete,
    isSelected,
    onSelect,
}: {
    step: Step;
    allSteps: Step[];
    onChange: (step: Step) => void;
    onDelete: () => void;
    isSelected: boolean;
    onSelect: () => void;
}) {
    const [showCode, setShowCode] = useState(false);
    const [expanded, setExpanded] = useState(false);

    const stepOptions = allSteps.filter(s => s.id !== step.id).map(s => ({
        value: s.id,
        label: `${s.label}: ${s.title.slice(0, 20)}${s.title.length > 20 ? '...' : ''}`,
    }));

    const borderColor = step.type === 'PROMPT'
        ? 'border-primary/40'
        : step.type === 'CONDITION'
            ? 'border-purple-500/40'
            : 'border-yellow-500/40';

    const bgColor = step.type === 'PROMPT'
        ? 'bg-primary/5'
        : step.type === 'CONDITION'
            ? 'bg-purple-500/5'
            : 'bg-yellow-500/5';

    const typeIcon = step.type === 'PROMPT' ? 'P' : step.type === 'CONDITION' ? '⚡' : '⏸';
    const typeColor = step.type === 'PROMPT'
        ? 'text-primary bg-primary/20'
        : step.type === 'CONDITION'
            ? 'text-purple-400 bg-purple-500/20'
            : 'text-yellow-400 bg-yellow-500/20';

    return (
        <div
            className={cn(
                "flex-shrink-0 w-64 rounded-xl border-2 transition-all duration-200",
                borderColor,
                bgColor,
                isSelected && "ring-2 ring-white/30 shadow-lg",
                step.isSubThread && "opacity-90"
            )}
            onClick={onSelect}
        >
            {/* Header */}
            <div className="flex items-center justify-between p-2 border-b border-white/10">
                <div className="flex items-center gap-2">
                    <div className={cn("w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold", typeColor)}>
                        {typeIcon}
                    </div>
                    <span className="text-xs font-bold text-muted-foreground">{step.label}</span>
                </div>
                <button
                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                    className="p-1 hover:bg-red-500/20 text-red-400 rounded opacity-50 hover:opacity-100"
                >
                    <TrashIcon className="w-3 h-3" />
                </button>
            </div>

            {/* Title */}
            <div className="p-2">
                <input
                    className="w-full bg-transparent text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary/40 rounded px-1"
                    value={step.title}
                    onChange={(e) => onChange({ ...step, title: e.target.value })}
                    placeholder={step.type === 'CONDITION' ? 'Condition name...' : 'Step title...'}
                    onClick={(e) => e.stopPropagation()}
                />
            </div>

            {/* Expand/Collapse */}
            <button
                onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
                className="w-full flex items-center justify-center gap-1 py-1 text-[10px] text-muted-foreground hover:bg-white/5 border-t border-white/5"
            >
                {expanded ? 'Collapse' : 'Expand'}
                <ChevronDownIcon className={cn("w-3 h-3 transition-transform", expanded && "rotate-180")} />
            </button>

            {/* Expanded Content */}
            {expanded && (
                <div className="p-2 space-y-2 border-t border-white/10 text-xs" onClick={(e) => e.stopPropagation()}>
                    {step.type === 'PROMPT' && (
                        <>
                            <div>
                                <label className="text-[9px] uppercase font-bold text-muted-foreground">Role</label>
                                <textarea
                                    className="w-full bg-black/20 border border-white/10 rounded p-1 text-xs resize-none h-12 mt-0.5"
                                    value={step.role || ''}
                                    onChange={(e) => onChange({ ...step, role: e.target.value })}
                                    placeholder="You are..."
                                />
                            </div>
                            <div>
                                <label className="text-[9px] uppercase font-bold text-muted-foreground">Task</label>
                                <textarea
                                    className="w-full bg-black/20 border border-white/10 rounded p-1 text-xs resize-none h-12 mt-0.5"
                                    value={step.task || ''}
                                    onChange={(e) => onChange({ ...step, task: e.target.value })}
                                    placeholder="Do this..."
                                />
                            </div>
                            <div>
                                <label className="text-[9px] uppercase font-bold text-muted-foreground">Guardrails</label>
                                <textarea
                                    className="w-full bg-black/20 border border-white/10 rounded p-1 text-xs resize-none h-10 mt-0.5"
                                    value={step.guardrails || ''}
                                    onChange={(e) => onChange({ ...step, guardrails: e.target.value })}
                                    placeholder="Don't do this..."
                                />
                            </div>
                        </>
                    )}

                    {step.type === 'CONDITION' && (
                        <>
                            <div>
                                <label className="text-[9px] uppercase font-bold text-muted-foreground">Type</label>
                                <select
                                    className="w-full bg-black/20 border border-white/10 rounded p-1 text-xs mt-0.5"
                                    value={step.conditionType || 'script'}
                                    onChange={(e) => onChange({ ...step, conditionType: e.target.value as 'script' | 'llm' })}
                                >
                                    <option value="script">Script (exit code)</option>
                                    <option value="llm">LLM Judge</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-[9px] uppercase font-bold text-muted-foreground">Description</label>
                                <input
                                    className="w-full bg-black/20 border border-white/10 rounded p-1 text-xs mt-0.5"
                                    value={step.conditionDescription || ''}
                                    onChange={(e) => onChange({ ...step, conditionDescription: e.target.value })}
                                    placeholder="Tests must pass..."
                                />
                            </div>
                            <button
                                onClick={() => setShowCode(true)}
                                className="w-full flex items-center justify-center gap-1 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 rounded text-purple-300 text-xs"
                            >
                                <CodeBracketIcon className="w-3 h-3" />
                                See Code
                            </button>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-[9px] uppercase font-bold text-green-400">On Pass →</label>
                                    <select
                                        className="w-full bg-black/20 border border-green-500/30 rounded p-1 text-xs mt-0.5"
                                        value={step.onPass || step.nextStep || ''}
                                        onChange={(e) => onChange({ ...step, onPass: e.target.value })}
                                    >
                                        <option value="">Next in order</option>
                                        {stepOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[9px] uppercase font-bold text-red-400">On Fail →</label>
                                    <select
                                        className="w-full bg-black/20 border border-red-500/30 rounded p-1 text-xs mt-0.5"
                                        value={step.onFail || ''}
                                        onChange={(e) => onChange({ ...step, onFail: e.target.value })}
                                    >
                                        <option value="">Stop</option>
                                        {stepOptions.filter(o => allSteps.find(s => s.id === o.value)?.isSubThread).map(o => (
                                            <option key={o.value} value={o.value}>{o.label}</option>
                                        ))}
                                        <option value="_new_sub">+ New Sub-thread</option>
                                    </select>
                                </div>
                            </div>
                        </>
                    )}

                    {step.type === 'BREAKPOINT' && (
                        <>
                            <div>
                                <label className="text-[9px] uppercase font-bold text-muted-foreground">Reason</label>
                                <input
                                    className="w-full bg-black/20 border border-white/10 rounded p-1 text-xs mt-0.5"
                                    value={step.reason || ''}
                                    onChange={(e) => onChange({ ...step, reason: e.target.value })}
                                    placeholder="Why start fresh..."
                                />
                            </div>
                            <div>
                                <label className="text-[9px] uppercase font-bold text-muted-foreground">Carry Forward</label>
                                <input
                                    className="w-full bg-black/20 border border-white/10 rounded p-1 text-xs mt-0.5"
                                    value={step.carryForward || ''}
                                    onChange={(e) => onChange({ ...step, carryForward: e.target.value })}
                                    placeholder="Key findings..."
                                />
                            </div>
                        </>
                    )}

                    {/* Next Step (for non-conditions) */}
                    {step.type !== 'CONDITION' && (
                        <div>
                            <label className="text-[9px] uppercase font-bold text-muted-foreground">Next Step →</label>
                            <select
                                className="w-full bg-black/20 border border-white/10 rounded p-1 text-xs mt-0.5"
                                value={step.nextStep || ''}
                                onChange={(e) => onChange({ ...step, nextStep: e.target.value })}
                            >
                                <option value="">Next in order</option>
                                {stepOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                        </div>
                    )}
                </div>
            )}

            {/* Code Modal */}
            {showCode && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowCode(false)}>
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                    <div className="relative w-full max-w-2xl bg-card rounded-xl border border-white/10 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-4 border-b border-white/10">
                            <h3 className="font-bold">Condition Code: {step.label}</h3>
                            <button onClick={() => setShowCode(false)} className="p-1 hover:bg-white/10 rounded">
                                <XMarkIcon className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-4">
                            <p className="text-xs text-muted-foreground mb-2">
                                This code runs to evaluate the condition. Exit code 0 = pass, non-zero = fail.
                                <br />
                                <span className="text-yellow-400">Note: The model does not see this code to prevent gaming the results.</span>
                            </p>
                            <textarea
                                className="w-full h-64 bg-black/40 border border-white/10 rounded-lg p-3 font-mono text-sm resize-none"
                                value={step.conditionCode || '#!/bin/bash\n\n# Example: Run tests\npytest tests/ -q\n\n# Exit code determines pass/fail'}
                                onChange={(e) => onChange({ ...step, conditionCode: e.target.value })}
                                placeholder="#!/bin/bash&#10;pytest tests/ -q"
                            />
                        </div>
                        <div className="flex justify-end gap-2 p-4 border-t border-white/10">
                            <button onClick={() => setShowCode(false)} className="btn btn-outline">Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// =============================================================================
// Add Step Button
// =============================================================================

function AddStepButton({ onAdd }: { onAdd: (type: StepType, isSubThread: boolean) => void }) {
    const [open, setOpen] = useState(false);

    return (
        <div className="relative flex-shrink-0">
            <button
                onClick={() => setOpen(!open)}
                className="w-12 h-12 flex items-center justify-center border-2 border-dashed border-white/20 hover:border-primary/40 rounded-xl text-muted-foreground hover:text-primary transition-all"
            >
                <PlusIcon className="w-5 h-5" />
            </button>

            {open && (
                <div className="absolute left-0 top-14 w-48 bg-card border border-white/10 rounded-xl shadow-xl z-50 overflow-hidden">
                    <div className="p-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-white/10 px-2 py-1">
                        Main Thread
                    </div>
                    <button
                        onClick={() => { onAdd('PROMPT', false); setOpen(false); }}
                        className="w-full flex items-center gap-2 p-2 hover:bg-primary/10 text-left text-sm"
                    >
                        <span className="w-5 h-5 rounded bg-primary/20 text-primary text-xs flex items-center justify-center font-bold">P</span>
                        Prompt Step
                    </button>
                    <button
                        onClick={() => { onAdd('CONDITION', false); setOpen(false); }}
                        className="w-full flex items-center gap-2 p-2 hover:bg-purple-500/10 text-left text-sm"
                    >
                        <span className="w-5 h-5 rounded bg-purple-500/20 text-purple-400 text-xs flex items-center justify-center">⚡</span>
                        Condition
                    </button>
                    <button
                        onClick={() => { onAdd('BREAKPOINT', false); setOpen(false); }}
                        className="w-full flex items-center gap-2 p-2 hover:bg-yellow-500/10 text-left text-sm"
                    >
                        <span className="w-5 h-5 rounded bg-yellow-500/20 text-yellow-400 text-xs flex items-center justify-center">⏸</span>
                        Breakpoint
                    </button>
                    <div className="p-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-t border-white/10 px-2 py-1">
                        Sub-Thread (for failures)
                    </div>
                    <button
                        onClick={() => { onAdd('PROMPT', true); setOpen(false); }}
                        className="w-full flex items-center gap-2 p-2 hover:bg-orange-500/10 text-left text-sm opacity-80"
                    >
                        <span className="w-5 h-5 rounded bg-orange-500/20 text-orange-400 text-xs flex items-center justify-center font-bold">S</span>
                        Sub Prompt
                    </button>
                </div>
            )}
        </div>
    );
}

// =============================================================================
// Main Component
// =============================================================================

type HorizontalStepFlowProps = {
    flow: Flow;
    onChange: (flow: Flow) => void;
};

export function HorizontalStepFlow({ flow, onChange }: HorizontalStepFlowProps) {
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const mainSteps = useMemo(() => flow.steps.filter(s => !s.isSubThread), [flow.steps]);
    const subSteps = useMemo(() => flow.steps.filter(s => s.isSubThread), [flow.steps]);

    const addStep = useCallback((type: StepType, isSubThread: boolean) => {
        const label = getNextLabel(flow.steps, isSubThread);
        const newStep: Step = {
            id: generateId(),
            type,
            label,
            title: '',
            isSubThread,
            subThreadLevel: isSubThread ? 1 : 0,
        };
        onChange({ ...flow, steps: [...flow.steps, newStep] });
        setSelectedId(newStep.id);
    }, [flow, onChange]);

    const updateStep = useCallback((id: string, step: Step) => {
        // Handle special "new sub" option
        if (step.onFail === '_new_sub') {
            const subLabel = getNextLabel(flow.steps, true);
            const newSub: Step = {
                id: generateId(),
                type: 'PROMPT',
                label: subLabel,
                title: 'Fix issue',
                isSubThread: true,
                subThreadLevel: 1,
                nextStep: id, // Loop back to condition by default
            };
            onChange({
                ...flow,
                steps: [
                    ...flow.steps.map(s => s.id === id ? { ...step, onFail: newSub.id } : s),
                    newSub,
                ],
            });
            return;
        }
        onChange({ ...flow, steps: flow.steps.map(s => s.id === id ? step : s) });
    }, [flow, onChange]);

    const deleteStep = useCallback((id: string) => {
        onChange({ ...flow, steps: flow.steps.filter(s => s.id !== id) });
        if (selectedId === id) setSelectedId(null);
    }, [flow, onChange, selectedId]);

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/5">
                <div>
                    <input
                        className="text-xl font-bold bg-transparent focus:outline-none"
                        value={flow.name}
                        onChange={(e) => onChange({ ...flow, name: e.target.value })}
                        placeholder="Flow Name"
                    />
                    <input
                        className="text-sm text-muted-foreground bg-transparent focus:outline-none block mt-1"
                        value={flow.description}
                        onChange={(e) => onChange({ ...flow, description: e.target.value })}
                        placeholder="Description..."
                    />
                </div>
                <div className="text-xs text-muted-foreground font-mono">
                    {mainSteps.length} steps • {subSteps.length} subs
                </div>
            </div>

            {/* Canvas */}
            <div className="flex-1 overflow-hidden relative">
                {/* Sub-threads (above main) */}
                {subSteps.length > 0 && (
                    <div className="absolute top-0 left-0 right-0 h-1/3 overflow-x-auto border-b border-dashed border-orange-500/20 bg-orange-500/5">
                        <div className="p-4 flex items-center gap-4 min-w-max h-full">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-orange-400/60 [writing-mode:vertical-rl] rotate-180 flex-shrink-0">
                                Sub-Thread
                            </div>
                            {subSteps.map((step, i) => (
                                <div key={step.id} className="flex items-center gap-2">
                                    <StepCard
                                        step={step}
                                        allSteps={flow.steps}
                                        onChange={(s) => updateStep(step.id, s)}
                                        onDelete={() => deleteStep(step.id)}
                                        isSelected={selectedId === step.id}
                                        onSelect={() => setSelectedId(step.id)}
                                    />
                                    {i < subSteps.length - 1 && (
                                        <ArrowRightIcon className="w-4 h-4 text-orange-400/40 flex-shrink-0" />
                                    )}
                                </div>
                            ))}
                            <AddStepButton onAdd={(type) => addStep(type, true)} />
                        </div>
                    </div>
                )}

                {/* Main thread */}
                <div className={cn(
                    "absolute left-0 right-0 bottom-0 overflow-x-auto",
                    subSteps.length > 0 ? "h-2/3 top-1/3" : "top-0 h-full"
                )}>
                    <div className="p-4 flex items-center gap-4 min-w-max h-full">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-primary/60 [writing-mode:vertical-rl] rotate-180 flex-shrink-0">
                            Main Thread
                        </div>
                        {mainSteps.map((step, i) => (
                            <div key={step.id} className="flex items-center gap-2">
                                <StepCard
                                    step={step}
                                    allSteps={flow.steps}
                                    onChange={(s) => updateStep(step.id, s)}
                                    onDelete={() => deleteStep(step.id)}
                                    isSelected={selectedId === step.id}
                                    onSelect={() => setSelectedId(step.id)}
                                />
                                {i < mainSteps.length - 1 && (
                                    <ArrowRightIcon className="w-4 h-4 text-primary/40 flex-shrink-0" />
                                )}
                            </div>
                        ))}
                        <AddStepButton onAdd={(type) => addStep(type, false)} />
                    </div>
                </div>

                {/* Empty state */}
                {flow.steps.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                            <div className="text-4xl mb-4">→</div>
                            <p className="text-muted-foreground">Click + to add your first step</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default HorizontalStepFlow;
