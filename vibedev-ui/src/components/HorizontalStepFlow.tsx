// =============================================================================
// Horizontal Step Flow Editor (Grid Layout)
// =============================================================================
// A deterministic 2D grid editor for workflows.
// - x-axis: Time/Sequence (colIndex)
// - y-axis: Thread Level (subThreadLevel)
// - Features: Atomic horizontal dragging, snapped grid, visual flow arrows.

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useClickOutside } from '@/hooks/useClickOutside';
import { cn } from '@/lib/utils';
import { useJobStepEvents } from '@/hooks/jobEventBus';
import {
    PlusIcon,
    TrashIcon,
    ChevronDownIcon,
    CodeBracketIcon,
    XMarkIcon,
    DocumentTextIcon, // For Prompt
} from '@heroicons/react/24/outline';

// =============================================================================
// Types
// =============================================================================

export type StepType = 'PROMPT' | 'CONDITION' | 'BREAKPOINT';

export type Step = {
    id: string;
    type: StepType;
    label: string;
    title: string;

    // Grid Coordinates
    colIndex: number;
    subThreadLevel: number;
    isSubThread: boolean;

    // For PROMPT
    role?: string;
    context?: string;
    task?: string;
    guardrails?: string;
    deliverables?: string;
    logInstruction?: string;
    examples?: string;
    showExamples?: boolean;

    // For CONDITION
    conditionType?: 'script' | 'llm';
    conditionCode?: string;
    conditionDescription?: string;
    onPass?: string;
    onFail?: string;

    // For BREAKPOINT
    reason?: string;
    carryForward?: string;

    // Navigation
    nextStep?: string;
};

export type Flow = {
    name: string;
    description: string;
    steps: Step[];
    globalContext: string;
};

// =============================================================================
// Constants & Helpers
// =============================================================================

const COL_WIDTH = 320;
const ROW_HEIGHT = 200;
const CARD_WIDTH = 280;

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

function normalizeLayout(steps: Step[]): Step[] {
    const byLevel: Record<number, Step[]> = {};
    steps.forEach(s => {
        const lvl = s.subThreadLevel ?? (s.isSubThread ? 1 : 0);
        if (!byLevel[lvl]) byLevel[lvl] = [];
        byLevel[lvl].push(s);
    });

    const newSteps = [...steps];
    let changed = false;

    Object.values(byLevel).forEach(levelSteps => {
        levelSteps.sort((a, b) => (a.colIndex ?? Infinity) - (b.colIndex ?? Infinity));
        levelSteps.forEach((s, i) => {
            if (s.colIndex === undefined) {
                const index = newSteps.findIndex(ns => ns.id === s.id);
                if (index !== -1) {
                    newSteps[index] = { ...s, colIndex: i };
                    changed = true;
                }
            }
        });
    });

    return changed ? newSteps : steps;
}

function getChain(startId: string, steps: Step[]): string[] {
    const startStep = steps.find(s => s.id === startId);
    if (!startStep || startStep.subThreadLevel === 0) return [startId];

    const level = startStep.subThreadLevel;
    const sameLevelSteps = steps.filter(s => s.subThreadLevel === level);

    const adj: Record<string, string[]> = {};
    sameLevelSteps.forEach(s => {
        const nextId = s.nextStep || s.onPass;
        if (nextId) {
            const next = sameLevelSteps.find(ns => ns.id === nextId);
            if (next) {
                if (!adj[s.id]) adj[s.id] = [];
                if (!adj[next.id]) adj[next.id] = [];
                adj[s.id].push(next.id);
                adj[next.id].push(s.id);
            }
        }
    });

    const chainIds: string[] = [];
    const visited = new Set<string>();
    const queue = [startId];
    visited.add(startId);

    while (queue.length > 0) {
        const curr = queue.shift()!;
        chainIds.push(curr);
        (adj[curr] || []).forEach(neighbor => {
            if (!visited.has(neighbor)) {
                visited.add(neighbor);
                queue.push(neighbor);
            }
        });
    }

    return chainIds;
}

/**
 * Calculate the smart default next step for a given step.
 * Logic:
 * 1. If there's a next step in the same thread (same level, next colIndex), use that
 * 2. If this is the last step in a sub-thread, default to the condition that created this sub-thread
 * 3. Otherwise, no default
 */
function getSmartDefaultNext(step: Step, allSteps: Step[]): string | undefined {
    const level = step.subThreadLevel ?? 0;
    const sameLevel = allSteps.filter(s => (s.subThreadLevel ?? 0) === level).sort((a, b) => (a.colIndex ?? 0) - (b.colIndex ?? 0));
    const idx = sameLevel.findIndex(s => s.id === step.id);

    // 1. Next in sequence
    if (idx !== -1 && idx < sameLevel.length - 1) {
        return sameLevel[idx + 1].id;
    }

    // 2. Last step in sub-thread? Find the condition that spawned this thread
    if (level > 0) {
        // Find first step in this sub-thread
        const firstInSub = sameLevel[0];

        // Find condition that points to this sub-thread
        const parentCondition = allSteps.find(s => s.onFail === firstInSub?.id);
        if (parentCondition) {
            return parentCondition.id;
        }
    }

    return undefined;
}

// =============================================================================
// Components
// =============================================================================

function AutoGrowTextarea({
    value,
    onChange,
    placeholder,
    className,
    disabled,
    maxLines = 8,
}: {
    value: string;
    onChange: (next: string) => void;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
    maxLines?: number;
}) {
    const ref = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        el.style.height = 'auto';

        const computed = window.getComputedStyle(el);
        const lhRaw = computed.lineHeight || '16px';
        const lh = Number.parseFloat(lhRaw) || 16;
        const maxHeight = Math.max(lh * maxLines, lh);
        el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
    }, [value, maxLines]);

    return (
        <textarea
            ref={ref}
            rows={1}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            className={cn(
                'resize-none overflow-hidden',
                disabled && 'cursor-not-allowed opacity-70',
                className
            )}
        />
    );
}

function StepCard({
    step,
    allSteps,
    onChange,
    onDelete,
    isSelected,
    onSelect,
    onDragStart,
    currentPhase: _currentPhase,
    status,
    lockCompletedSteps,
}: {
    step: Step;
    allSteps: Step[];
    onChange: (step: Step) => void;
    onDelete: () => void;
    isSelected: boolean;
    onSelect: () => void;
    onDragStart: (e: React.MouseEvent) => void;
    currentPhase?: string;
    status?: 'PENDING' | 'ACTIVE' | 'DONE' | string;
    lockCompletedSteps?: boolean;
}) {
    const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
    const deleteRef = useRef<HTMLDivElement>(null);
    useClickOutside(deleteRef, () => setIsConfirmingDelete(false));
    const [showCode, setShowCode] = useState(false);
    const [expanded, setExpanded] = useState(false);

    const stepOptions = allSteps.filter(s => s.id !== step.id).map(s => ({
        value: s.id,
        label: `${s.label}: ${s.title.slice(0, 20)}${s.title.length > 20 ? '...' : ''}`,
    }));

    const borderColor = status === 'DONE'
        ? 'border-green-500/50'
        : status === 'RUNNING'
            ? 'border-red-500/60'
            : status === 'FAILED'
                ? 'border-orange-500/60'
                : status === 'LOCKED'
                    ? 'border-yellow-500/50'
                    : status === 'ACTIVE'
                        ? 'border-blue-500/50'
                        : step.type === 'PROMPT'
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

    const isMainThread = step.subThreadLevel === 0;
    const isLocked = Boolean(
        lockCompletedSteps
        && ['RUNNING', 'DONE', 'FAILED', 'LOCKED'].includes(String(status || ''))
    );
    const stepEvents = useJobStepEvents(status === 'RUNNING' ? step.id : null);
    const safeOnChange = (next: Step) => {
        if (isLocked) return;
        onChange(next);
    };

    return (
        <div
            ref={deleteRef}
            className={cn(
                "w-[280px] rounded-xl border-2 transition-shadow duration-200 bg-card/80 backdrop-blur-md select-none",
                borderColor,
                bgColor,
                isSelected && "ring-2 ring-white/30 shadow-lg",
                step.isSubThread && "opacity-95",
                isLocked && "opacity-80"
            )}
            onClick={onSelect}
        >
            {/* Header / Drag Handle - Draggable Area */}
            <div
                className={cn(
                    "flex items-center justify-between p-2 border-b border-white/10 group",
                    !isMainThread && "cursor-move hover:bg-white/5 active:bg-white/10 transition-colors"
                )}
                onMouseDown={(e) => {
                    if (!isMainThread) onDragStart(e);
                }}
            >
                <div className="flex items-center gap-2">
                    {/* Fixed Label or Spacer */}
                    {isMainThread ? (
                        <div className="pr-1"><span className="text-[10px] text-primary/40 font-mono">FIXED</span></div>
                    ) : null}

                    <div className={cn("w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold", typeColor)}>
                        {typeIcon}
                    </div>
                    <span className="text-xs font-bold text-muted-foreground select-none">{step.label}</span>
                    {status === 'RUNNING' && (
                        <span className="text-[9px] font-bold text-red-200 bg-red-500/15 border border-red-500/30 px-1.5 py-0.5 rounded">
                            RUNNING
                        </span>
                    )}
                    {status === 'DONE' && (
                        <span className="text-[9px] font-bold text-green-300 bg-green-500/15 border border-green-500/30 px-1.5 py-0.5 rounded">
                            DONE
                        </span>
                    )}
                    {status === 'FAILED' && (
                        <span className="text-[9px] font-bold text-orange-200 bg-orange-500/15 border border-orange-500/30 px-1.5 py-0.5 rounded">
                            FAILED
                        </span>
                    )}
                    {status === 'LOCKED' && (
                        <span className="text-[9px] font-bold text-yellow-200 bg-yellow-500/15 border border-yellow-500/30 px-1.5 py-0.5 rounded">
                            LOCKED
                        </span>
                    )}
                    {status === 'ACTIVE' && (
                        <span className="text-[9px] font-bold text-blue-300 bg-blue-500/15 border border-blue-500/30 px-1.5 py-0.5 rounded">
                            ACTIVE
                        </span>
                    )}
                </div>

                {isLocked ? (
                    <span className="text-[9px] font-bold text-green-300/80 bg-green-500/10 border border-green-500/20 px-2 py-1 rounded">
                        LOCKED
                    </span>
                ) : isConfirmingDelete ? (
                    <div className="flex items-center gap-1 animate-in fade-in slide-in-from-right-1 duration-200">
                        <span className="text-[9px] font-bold text-red-400 uppercase tracking-tighter">Sure?</span>
                        <button
                            onClick={(e) => { e.stopPropagation(); onDelete(); }}
                            className="p-1 bg-red-500/20 hover:bg-red-500 text-white rounded transition-all"
                            title="Yes, delete"
                        >
                            <TrashIcon className="w-3 h-3" />
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); setIsConfirmingDelete(false); }}
                            className="p-1 hover:bg-white/10 text-muted-foreground rounded"
                            title="Cancel"
                        >
                            <XMarkIcon className="w-3 h-3" />
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={(e) => { e.stopPropagation(); setIsConfirmingDelete(true); }}
                        className="p-1 hover:bg-red-500/20 text-red-400 rounded opacity-50 hover:opacity-100 transition-all"
                        title="Delete step"
                    >
                        <TrashIcon className="w-3 h-3" />
                    </button>
                )}
            </div>

            {/* Title */}
            <div className="p-2">
                <input
                    className="w-full bg-transparent text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary/40 rounded px-1"
                    value={step.title}
                    onChange={(e) => safeOnChange({ ...step, title: e.target.value })}
                    placeholder={step.type === 'CONDITION' ? 'Condition name...' : 'Step title...'}
                    onClick={(e) => e.stopPropagation()}
                    disabled={isLocked}
                />
            </div>

            {/* Expand Toggle */}
            <div className="px-2 pb-2">
                <button
                    onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
                    className="w-full flex items-center justify-center gap-1 py-1 text-[10px] text-muted-foreground hover:bg-white/5 rounded border border-white/5"
                >
                    {expanded ? 'Collapse' : 'Expand'}
                    <ChevronDownIcon className={cn("w-3 h-3 transition-transform", expanded && "rotate-180")} />
                </button>
            </div>

            {/* Expanded Fields */}
            {expanded && (
                <div className="p-2 space-y-2 border-t border-white/10 text-xs" onClick={(e) => e.stopPropagation()}>
                    {step.type === 'PROMPT' && (
                        <>
                            <div>
                                <label className="text-[9px] uppercase font-bold text-muted-foreground">Role</label>
                                <AutoGrowTextarea
                                    className="w-full bg-black/20 border border-white/10 rounded p-1 text-xs mt-0.5 placeholder-gray-600 placeholder-opacity-60"
                                    value={step.role || ''}
                                    onChange={(next) => safeOnChange({ ...step, role: next })}
                                    disabled={isLocked}
                                    maxLines={4}
                                    placeholder="Who should the model be for this step?"
                                />
                            </div>
                            <div>
                                <label className="text-[9px] uppercase font-bold text-muted-foreground">Context</label>
                                <AutoGrowTextarea
                                    className="w-full bg-black/20 border border-white/10 rounded p-1 text-xs mt-0.5 placeholder-gray-600 placeholder-opacity-60"
                                    value={step.context || ''}
                                    onChange={(next) => safeOnChange({ ...step, context: next })}
                                    disabled={isLocked}
                                    maxLines={8}
                                    placeholder="What does the model need to know?"
                                />
                            </div>
                            <div>
                                <label className="text-[9px] uppercase font-bold text-muted-foreground">Task</label>
                                <AutoGrowTextarea
                                    className="w-full bg-black/20 border border-white/10 rounded p-1 text-xs mt-0.5 placeholder-gray-600 placeholder-opacity-60"
                                    value={step.task || ''}
                                    onChange={(next) => safeOnChange({ ...step, task: next })}
                                    disabled={isLocked}
                                    maxLines={8}
                                    placeholder="What should the model do?"
                                />
                            </div>
                            <div>
                                <label className="text-[9px] uppercase font-bold text-muted-foreground">Guardrails</label>
                                <AutoGrowTextarea
                                    className="w-full bg-black/20 border border-white/10 rounded p-1 text-xs mt-0.5 placeholder-gray-600 placeholder-opacity-60"
                                    value={step.guardrails || ''}
                                    onChange={(next) => safeOnChange({ ...step, guardrails: next })}
                                    disabled={isLocked}
                                    maxLines={6}
                                    placeholder="What constraints should it follow?"
                                />
                            </div>
                            <div>
                                <label className="text-[9px] uppercase font-bold text-muted-foreground">Deliverables</label>
                                <AutoGrowTextarea
                                    className="w-full bg-black/20 border border-white/10 rounded p-1 text-xs mt-0.5 placeholder-gray-600 placeholder-opacity-60"
                                    value={step.deliverables || ''}
                                    onChange={(next) => safeOnChange({ ...step, deliverables: next })}
                                    disabled={isLocked}
                                    maxLines={6}
                                    placeholder="What are the expected outputs?"
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
                                    onChange={(e) => safeOnChange({ ...step, conditionType: e.target.value as 'script' | 'llm' })}
                                    disabled={isLocked}
                                >
                                    <option value="script">Script (exit code)</option>
                                    <option value="llm">LLM Judge</option>
                                </select>
                            </div>

                            <button
                                onClick={() => setShowCode(true)}
                                className={cn(
                                    "w-full flex items-center justify-center gap-1 py-1.5 rounded text-xs font-bold transition-colors",
                                    step.conditionType === 'llm'
                                        ? "bg-blue-500/20 hover:bg-blue-500/30 text-blue-300"
                                        : "bg-purple-500/20 hover:bg-purple-500/30 text-purple-300"
                                )}
                            >
                                {step.conditionType === 'llm' ? (
                                    <><DocumentTextIcon className="w-3 h-3" /> See Prompt</>
                                ) : (
                                    <><CodeBracketIcon className="w-3 h-3" /> See Code</>
                                )}
                            </button>
                        </>
                    )}

                    {step.type === 'BREAKPOINT' && (
                        <>
                            <div>
                                <label className="text-[9px] uppercase font-bold text-muted-foreground">Reason</label>
                                <input
                                    className="w-full bg-black/20 border border-white/10 rounded p-1 text-xs mt-0.5 placeholder-gray-600 placeholder-opacity-60"
                                    value={step.reason || ''}
                                    onChange={(e) => safeOnChange({ ...step, reason: e.target.value })}
                                    placeholder="Why start a new thread?"
                                    disabled={isLocked}
                                />
                            </div>
                            <div>
                                <label className="text-[9px] uppercase font-bold text-muted-foreground">Findings to Gather (Memory Block)</label>
                                <AutoGrowTextarea
                                    className="w-full bg-black/20 border border-white/10 rounded p-1 text-xs mt-0.5 placeholder-gray-600 placeholder-opacity-60"
                                    value={step.carryForward || ''}
                                    onChange={(next) => safeOnChange({ ...step, carryForward: next })}
                                    disabled={isLocked}
                                    maxLines={8}
                                    placeholder="What findings should be compiled into the memory block?"
                                />
                            </div>
                        </>
                    )}

                    <div>
                        <label className="text-[9px] uppercase font-bold text-muted-foreground">Log Instruction</label>
                        <AutoGrowTextarea
                            className="w-full bg-black/20 border border-white/10 rounded p-1 text-xs mt-0.5 placeholder-gray-600 placeholder-opacity-60"
                            value={step.logInstruction || ''}
                            onChange={(next) => safeOnChange({ ...step, logInstruction: next })}
                            disabled={isLocked}
                            maxLines={6}
                            placeholder="What should the model log?"
                        />
                    </div>

                    {status === 'RUNNING' && (
                        <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-2">
                            <div className="text-[9px] uppercase font-bold text-red-200 mb-1">Live activity</div>
                            {stepEvents.length === 0 ? (
                                <div className="text-[11px] text-muted-foreground">Waiting for events…</div>
                            ) : (
                                <div className="space-y-1 max-h-28 overflow-auto pr-1">
                                    {stepEvents.slice(0, 6).map((e, idx) => (
                                        <div key={idx} className="text-[11px] text-white/80">
                                            <span className="text-white/50">{e.type}</span>
                                            {e?.data?.block_type ? <span className="text-white/60"> · {String(e.data.block_type)}</span> : null}
                                            {e?.data?.title ? <span className="text-white/60"> · {String(e.data.title).slice(0, 60)}</span> : null}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ALWAYS SHOW NEXT STEP SELECT */}
                    <div className="pt-2 border-t border-white/5">
                        <div className="grid grid-cols-1 gap-2">
                            {step.type === 'CONDITION' ? (
                                <>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="text-[9px] uppercase font-bold text-green-400">On Pass →</label>
                                            <select
                                                className="w-full bg-black/20 border border-green-500/30 rounded p-1 text-[10px] mt-0.5"
                                                value={step.onPass || step.nextStep || ''}
                                                onChange={(e) => safeOnChange({ ...step, onPass: e.target.value })}
                                                disabled={isLocked}
                                            >
                                                {(() => {
                                                    const smartDefault = getSmartDefaultNext(step, allSteps);
                                                    const defaultStep = smartDefault ? allSteps.find(s => s.id === smartDefault) : null;
                                                    const defaultLabel = defaultStep
                                                        ? `Auto: ${defaultStep.label}`
                                                        : 'None';
                                                    return <option value="">{defaultLabel}</option>;
                                                })()}
                                                {stepOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[9px] uppercase font-bold text-red-400">On Fail →</label>
                                            <select
                                                className="w-full bg-black/20 border border-red-500/30 rounded p-1 text-[10px] mt-0.5"
                                                value={step.onFail || ''}
                                                onChange={(e) => safeOnChange({ ...step, onFail: e.target.value })}
                                                disabled={isLocked}
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
                            ) : (
                                <div>
                                    <label className="text-[9px] uppercase font-bold text-green-400">Next Step →</label>
                                    <select
                                        className="w-full bg-black/20 border border-green-500/20 rounded p-1 text-[10px] mt-0.5"
                                        value={step.nextStep || ''}
                                        onChange={(e) => safeOnChange({ ...step, nextStep: e.target.value })}
                                        disabled={isLocked}
                                    >
                                        {(() => {
                                            const smartDefault = getSmartDefaultNext(step, allSteps);
                                            const defaultStep = smartDefault ? allSteps.find(s => s.id === smartDefault) : null;
                                            const defaultLabel = defaultStep
                                                ? `Auto: ${defaultStep.label}`
                                                : 'None';
                                            return <option value="">{defaultLabel}</option>;
                                        })()}
                                        {stepOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                    </select>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Condition Edit Modal */}
            {showCode && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 cursor-default" onClick={() => setShowCode(false)}>
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
                    <div className="relative w-full max-w-2xl bg-card rounded-xl border border-white/10 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="p-4 border-b border-white/10">
                            <h3 className="font-bold">
                                {step.conditionType === 'llm' ? 'LLM Judge Prompt' : 'Validation Script'}
                            </h3>
                        </div>
                        <div className="p-4">
                            <textarea
                                className="w-full h-64 bg-black/40 border border-white/10 rounded-lg p-3 font-mono text-sm resize-none focus:border-primary/50 outline-none placeholder-gray-600 placeholder-opacity-60"
                                value={step.conditionCode || ''}
                                onChange={(e) => safeOnChange({ ...step, conditionCode: e.target.value })}
                                disabled={isLocked}
                                placeholder={
                                    step.conditionType === 'llm'
                                        ? 'Ask a TRUE/FALSE question. Answer must be TRUE to pass.'
                                        : 'Command to run. Exit code 0 = pass.'
                                }
                            />
                        </div>
                        <div className="p-4 border-t border-white/10 flex justify-end">
                            <button onClick={() => setShowCode(false)} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded">Done</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function AddStepButton({ onAdd }: { onAdd: (type: StepType) => void }) {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    useClickOutside(containerRef, () => setOpen(false));

    return (
        <div className="relative z-20" ref={containerRef}>
            <button
                onClick={() => setOpen(!open)}
                className="w-12 h-12 flex items-center justify-center rounded-xl border-2 border-dashed border-white/10 hover:border-primary/50 hover:bg-primary/5 text-muted-foreground hover:text-white transition-colors"
            >
                <PlusIcon className="w-6 h-6" />
            </button>
            {open && (
                <div className="absolute top-full left-0 mt-2 bg-card border border-white/10 rounded-xl shadow-xl p-2 flex flex-col gap-1 w-32 z-50">
                    <button onClick={() => { onAdd('PROMPT'); setOpen(false); }} className="text-left px-2 py-1 hover:bg-white/10 rounded text-xs">Prompt</button>
                    <button onClick={() => { onAdd('CONDITION'); setOpen(false); }} className="text-left px-2 py-1 hover:bg-white/10 rounded text-xs">Condition</button>
                    <button onClick={() => { onAdd('BREAKPOINT'); setOpen(false); }} className="text-left px-2 py-1 hover:bg-white/10 rounded text-xs">Breakpoint</button>
                </div>
            )}
        </div>
    );
}

// =============================================================================
// SVG Connections
// =============================================================================

function FlowConnections({ steps }: { steps: Step[] }) {
    const maxLevel = Math.max(0, ...steps.map(s => s.subThreadLevel ?? 0));

    // Card center offset
    const OX = CARD_WIDTH;
    const OY = 30;
    const TX = 0;
    const TY = 30;

    const getCoords = (s: Step) => {
        const x = (s.colIndex ?? 0) * COL_WIDTH;
        const level = s.subThreadLevel ?? 0;
        const y = (maxLevel - level) * ROW_HEIGHT + 50;
        return { x, y };
    };

    return (
        <svg className="absolute inset-0 pointer-events-none overflow-visible w-full h-full z-0 opacity-80">
            {/* Define marker for arrows */}
            <defs>
                <marker id="arrowhead-green" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                    <path d="M0,0 L6,3 L0,6 Z" fill="#4ade80" />
                </marker>
                <marker id="arrowhead-red" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                    <path d="M0,0 L6,3 L0,6 Z" fill="#f87171" />
                </marker>
            </defs>

            {steps.map(step => {
                const start = getCoords(step);
                const startX = start.x + OX;
                const startY = start.y + OY;

                const lines = [];

                // 1. Next Step / On Pass / Implicit (GREEN ARROW)
                const nextId = step.onPass || step.nextStep || getSmartDefaultNext(step, steps);
                if (nextId) {
                    const next = steps.find(s => s.id === nextId);
                    if (next) {
                        const end = getCoords(next);
                        const endX = end.x + TX;
                        const endY = end.y + TY;

                        const cx1 = startX + 50;
                        const cy1 = startY;
                        const cx2 = endX - 50;
                        const cy2 = endY;

                        lines.push(
                            <path
                                key={`next-${step.id}`}
                                d={`M ${startX} ${startY} C ${cx1} ${cy1} ${cx2} ${cy2} ${endX} ${endY}`}
                                stroke="#4ade80"
                                strokeWidth="2"
                                fill="none"
                                strokeOpacity="0.9"
                                markerEnd="url(#arrowhead-green)"
                                className="transition-all duration-300"
                            />
                        );
                    }
                }

                // 2. Fail Step (RED ARROW - points at bottom-right corner)
                if (step.onFail) {
                    const fail = steps.find(s => s.id === step.onFail);
                    if (fail) {
                        const end = getCoords(fail);
                        // Point directly at the bottom-right corner of the card
                        const cornerX = end.x + CARD_WIDTH;
                        const cornerY = end.y + 60;

                        // Simple curve that clearly points at the corner
                        const cx1 = startX + 80;
                        const cy1 = startY + 40;
                        const cx2 = cornerX + 40; // Approach from the right
                        const cy2 = cornerY;

                        lines.push(
                            <path
                                key={`fail-${step.id}`}
                                d={`M ${startX} ${startY} C ${cx1} ${cy1} ${cx2} ${cy2} ${cornerX} ${cornerY}`}
                                stroke="#f87171"
                                strokeWidth="2"
                                fill="none"
                                markerEnd="url(#arrowhead-red)"
                                strokeOpacity="0.9"
                            />
                        );
                    }
                }

                return lines;
            })}
        </svg>
    );
}

// =============================================================================
// Main Canvas
// =============================================================================

export function HorizontalStepFlow({
    flow,
    onChange,
    currentPhase,
    stepStatusById,
    lockCompletedSteps,
}: {
    flow: Flow;
    onChange: (f: Flow) => void;
    currentPhase?: string;
    stepStatusById?: Record<string, string>;
    lockCompletedSteps?: boolean;
}) {
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const dragOrigin = useRef<{ x: number, y: number } | null>(null);
    const chainIds = useRef<string[]>([]);
    const containerRef = useRef<HTMLDivElement>(null);

    // Canvas panning state
    const [isPanning, setIsPanning] = useState(false);

    // Canvas panning handler - uses inline closures to avoid stale callback issues
    const handlePanStart = useCallback((e: React.MouseEvent) => {
        // Only pan if clicking on empty canvas (not on a node)
        if ((e.target as HTMLElement).closest('[data-step-card]')) return;
        if (!containerRef.current) return;
        // Only left mouse button
        if (e.button !== 0) return;

        // Capture all values at click time in closure
        const startX = e.clientX;
        const startY = e.clientY;
        const container = containerRef.current;
        const scrollLeft = container.scrollLeft;
        const scrollTop = container.scrollTop;

        setIsPanning(true);

        function onMove(moveEvent: MouseEvent) {
            container.scrollLeft = scrollLeft - (moveEvent.clientX - startX);
            container.scrollTop = scrollTop - (moveEvent.clientY - startY);
        }

        function onUp() {
            setIsPanning(false);
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        }

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        e.preventDefault();
    }, []);

    const steps = useMemo(() => normalizeLayout(flow.steps), [flow.steps]);

    // Calculate valid columns for the current dragging level
    const levelColumns = useMemo(() => {
        if (!draggingId) return [];
        const dragStep = steps.find(s => s.id === draggingId);
        if (!dragStep) return [];

        const lvl = dragStep.subThreadLevel ?? 0;
        const levelSteps = steps.filter(s => s.subThreadLevel === lvl && !chainIds.current.includes(s.id));
        const usedCols = new Set(levelSteps.map(s => s.colIndex ?? 0));

        // Find max column to allow dragging to the end
        const maxC = Math.max(5, ...steps.map(s => s.colIndex ?? 0)) + 5;
        const valid = [];
        for (let i = 0; i < maxC; i++) {
            if (!usedCols.has(i)) valid.push(i);
        }
        return valid;
    }, [draggingId, steps]);

    const dragCol = draggingId ? Math.max(0, Math.round((steps.find(s => s.id === draggingId)!.colIndex! * COL_WIDTH + dragOffset.x) / COL_WIDTH)) : null;
    const isDragOverValid = dragCol !== null && levelColumns.includes(dragCol);

    const maxLevel = Math.max(0, ...steps.map(s => s.subThreadLevel ?? 0));
    const canvasHeight = Math.max(600, (maxLevel + 1) * ROW_HEIGHT + 150);

    // Initial scroll to bottom (main thread)
    useEffect(() => {
        if (containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
    }, [flow.name]); // Trigger on name/phase change

    const getVisualY = (level: number) => {
        return (maxLevel - level) * ROW_HEIGHT + 50;
    };

    const handleDragStart = (e: React.MouseEvent, step: Step) => {
        if (step.subThreadLevel === 0) return;
        e.stopPropagation();
        setDraggingId(step.id);
        dragOrigin.current = { x: e.clientX, y: e.clientY };
        chainIds.current = getChain(step.id, steps);
        setDragOffset({ x: 0, y: 0 });
    };

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!draggingId || !dragOrigin.current) return;
        setDragOffset({
            x: e.clientX - dragOrigin.current.x,
            y: 0
        });
    }, [draggingId]);

    const handleMouseUp = useCallback(() => {
        if (!draggingId) return;

        const dragStep = steps.find(s => s.id === draggingId);
        if (dragStep) {
            const targetCol = Math.round((dragStep.colIndex * COL_WIDTH + dragOffset.x) / COL_WIDTH);
            const canDrop = levelColumns.includes(targetCol);

            if (canDrop && targetCol !== dragStep.colIndex) {
                const deltaCol = targetCol - dragStep.colIndex;
                const chain = chainIds.current;
                const newSteps = steps.map(s => {
                    if (chain.includes(s.id)) {
                        return { ...s, colIndex: Math.max(0, (s.colIndex ?? 0) + deltaCol) };
                    }
                    return s;
                });
                onChange({ ...flow, steps: newSteps });
            }
        }

        setDraggingId(null);
        setDragOffset({ x: 0, y: 0 });
        chainIds.current = [];
    }, [draggingId, dragOffset, steps, flow, onChange, levelColumns]);

    useEffect(() => {
        if (draggingId) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [draggingId, handleMouseMove, handleMouseUp]);

    const addStep = (type: StepType, level: number) => {
        const levelSteps = steps.filter(s => (s.subThreadLevel ?? 0) === level);
        const maxCol = Math.max(-1, ...levelSteps.map(s => s.colIndex ?? 0));

        const isSub = level > 0;
        const newStep: Step = {
            id: generateId(),
            type,
            label: getNextLabel(steps, isSub),
            title: '',
            isSubThread: isSub,
            subThreadLevel: level,
            colIndex: maxCol + 1
        };
        onChange({ ...flow, steps: [...flow.steps, newStep] });
    };

    const updateStep = (id: string, step: Step) => {
        if (step.onFail === '_new_sub') {
            const parent = steps.find(s => s.id === id);
            const baseCol = parent?.colIndex ?? 0;
            const baseLvl = parent?.subThreadLevel ?? 0;
            const newLvl = baseLvl + 1;
            const newCol = Math.max(0, baseCol - 1);

            let modifiedSteps = [...flow.steps];
            modifiedSteps = modifiedSteps.map(s => {
                if ((s.subThreadLevel ?? 0) === newLvl && (s.colIndex ?? 0) >= newCol) {
                    return { ...s, colIndex: (s.colIndex ?? 0) + 1 };
                }
                return s;
            });

            const newSub: Step = {
                id: generateId(),
                type: 'PROMPT',
                label: getNextLabel(steps, true),
                title: 'Fix issue',
                isSubThread: true,
                subThreadLevel: newLvl,
                colIndex: newCol,
            };

            onChange({
                ...flow,
                steps: [
                    ...modifiedSteps.map(s => s.id === id ? { ...step, onFail: newSub.id } : s),
                    newSub
                ]
            });
            return;
        }
        onChange({ ...flow, steps: flow.steps.map(s => s.id === id ? step : s) });
    };

    return (
        <div className="h-full flex flex-col bg-dots-pattern overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/5 bg-card z-20 shadow-md">
                <div className="flex items-center gap-4">
                    <button className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                        <span className="text-xl font-bold tracking-tight text-primary">{flow.name}</span>
                    </button>
                </div>
                <div className="text-xs text-muted-foreground font-mono bg-black/40 px-2 py-1 rounded border border-white/5">
                    Flow Canvas • {steps.length} nodes
                </div>
            </div>

            {/* 2D Canvas */}
            <div
                ref={containerRef}
                className={cn(
                    "flex-1 overflow-auto relative select-none",
                    isPanning ? "cursor-grabbing" : "cursor-grab"
                )}
                onMouseDown={handlePanStart}
            >
                <div
                    className="relative min-w-[4000px] bg-dots-pattern"
                    style={{ height: canvasHeight }}
                >
                    {/* Snap Guide / Drop Target */}
                    {draggingId && isDragOverValid && (
                        <div
                            className="absolute w-[300px] h-[100px] border-2 border-dashed border-primary/40 bg-primary/20 rounded-xl z-0 transition-all duration-150 animate-pulse pointer-events-none"
                            style={{
                                transform: `translate(${dragCol! * COL_WIDTH - 10}px, ${getVisualY(steps.find(s => s.id === draggingId)!.subThreadLevel) - 10}px)`
                            }}
                        />
                    )}

                    {/* SVG LAYER BEHIND NODES */}
                    <FlowConnections steps={steps} />

                    {/* NODES LAYER */}
                    {steps.map(step => {
                        const isInDraggedChain = chainIds.current.includes(step.id);
                        const visualX = (step.colIndex ?? 0) * COL_WIDTH;
                        const visualY = getVisualY(step.subThreadLevel ?? 0);
                        const offsetX = isInDraggedChain ? dragOffset.x : 0;

                        return (
                            <div
                                key={step.id}
                                data-step-card
                                className={cn(
                                    "absolute rounded-xl transition-[transform,shadow]",
                                    isInDraggedChain ? "z-50 shadow-[0_20px_50px_rgba(0,0,0,0.5)] cursor-grabbing scale-[1.02]" : "z-10 duration-200"
                                )}
                                style={{
                                    transform: `translate(${visualX + offsetX}px, ${visualY}px)`
                                }}
                            >
                                <StepCard
                                    step={step}
                                    allSteps={steps}
                                    onChange={(s) => updateStep(step.id, s)}
                                    onDelete={() => onChange({ ...flow, steps: flow.steps.filter(x => x.id !== step.id) })}
                                    isSelected={selectedId === step.id}
                                    onSelect={() => setSelectedId(step.id)}
                                    onDragStart={(e) => handleDragStart(e, step)}
                                    currentPhase={currentPhase}
                                    status={stepStatusById?.[step.id]}
                                    lockCompletedSteps={lockCompletedSteps}
                                />
                            </div>
                        );
                    })}

                    {/* CONTROL LAYER: ADD BUTTONS */}
                    {Array.from({ length: maxLevel + 2 }).map((_, lvl) => {
                        const levelSteps = steps.filter(s => (s.subThreadLevel ?? 0) === lvl);
                        const maxC = Math.max(-1, ...levelSteps.map(s => s.colIndex ?? 0));
                        const vX = (maxC + 1) * COL_WIDTH;
                        const vY = getVisualY(lvl) + 20;

                        return (
                            <div key={lvl} data-step-card className="absolute z-10" style={{ transform: `translate(${vX}px, ${vY}px)` }}>
                                <div className="flex flex-col items-center gap-2">
                                    <span className="text-[10px] uppercase font-bold opacity-20 tracking-widest pointer-events-none select-none">
                                        {lvl === 0 ? 'Main Stream' : `Level ${lvl}`}
                                    </span>
                                    <AddStepButton onAdd={(t) => addStep(t, lvl)} />
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    );
}

export default HorizontalStepFlow;
