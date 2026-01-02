// =============================================================================
// Horizontal Step Flow Editor (Grid Layout)
// =============================================================================
// A deterministic 2D grid editor for workflows.
// - x-axis: Time/Sequence (colIndex)
// - y-axis: Thread Level (subThreadLevel)
// - Features: Atomic horizontal dragging, snapped grid, visual flow arrows.

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
    PlusIcon,
    TrashIcon,
    ChevronDownIcon,
    CodeBracketIcon,
    XMarkIcon,
    ArrowsPointingOutIcon, // Drag icon
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

function StepCard({
    step,
    allSteps,
    onChange,
    onDelete,
    isSelected,
    onSelect,
    onDragStart,
}: {
    step: Step;
    allSteps: Step[];
    onChange: (step: Step) => void;
    onDelete: () => void;
    isSelected: boolean;
    onSelect: () => void;
    onDragStart: (e: React.MouseEvent) => void;
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

    const isMainThread = step.subThreadLevel === 0;

    return (
        <div
            className={cn(
                "w-[280px] rounded-xl border-2 transition-shadow duration-200 bg-card/80 backdrop-blur-md select-none",
                borderColor,
                bgColor,
                isSelected && "ring-2 ring-white/30 shadow-lg",
                step.isSubThread && "opacity-95"
            )}
            onClick={onSelect}
        >
            {/* Header / Drag Handle */}
            <div className="flex items-center justify-between p-2 border-b border-white/10 group">
                <div className="flex items-center gap-2">
                    {!isMainThread ? (
                        <div
                            className="cursor-move p-1 hover:bg-white/10 rounded text-muted-foreground hover:text-white"
                            onMouseDown={onDragStart}
                            title="Drag horizontal"
                        >
                            <ArrowsPointingOutIcon className="w-4 h-4" />
                        </div>
                    ) : (
                        <div className="p-1"><span className="text-[10px] text-primary/40 font-mono">FIXED</span></div>
                    )}

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
                                <textarea
                                    className="w-full bg-black/20 border border-white/10 rounded p-1 text-xs resize-none h-10 mt-0.5"
                                    value={step.role || ''}
                                    onChange={(e) => onChange({ ...step, role: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="text-[9px] uppercase font-bold text-muted-foreground">Context</label>
                                <textarea
                                    className="w-full bg-black/20 border border-white/10 rounded p-1 text-xs resize-none h-16 mt-0.5"
                                    value={step.context || ''}
                                    onChange={(e) => onChange({ ...step, context: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="text-[9px] uppercase font-bold text-muted-foreground">Task</label>
                                <textarea
                                    className="w-full bg-black/20 border border-white/10 rounded p-1 text-xs resize-none h-16 mt-0.5"
                                    value={step.task || ''}
                                    onChange={(e) => onChange({ ...step, task: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="text-[9px] uppercase font-bold text-muted-foreground">Guardrails</label>
                                <textarea
                                    className="w-full bg-black/20 border border-white/10 rounded p-1 text-xs resize-none h-10 mt-0.5"
                                    value={step.guardrails || ''}
                                    onChange={(e) => onChange({ ...step, guardrails: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="text-[9px] uppercase font-bold text-muted-foreground">Outputs</label>
                                <textarea
                                    className="w-full bg-black/20 border border-white/10 rounded p-1 text-xs resize-none h-10 mt-0.5"
                                    value={step.deliverables || ''}
                                    onChange={(e) => onChange({ ...step, deliverables: e.target.value })}
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
                                    className="w-full bg-black/20 border border-white/10 rounded p-1 text-xs mt-0.5"
                                    value={step.reason || ''}
                                    onChange={(e) => onChange({ ...step, reason: e.target.value })}
                                    placeholder="Why start fresh..."
                                />
                            </div>
                            <div>
                                <label className="text-[9px] uppercase font-bold text-muted-foreground">Findings to Gather (Memory Block)</label>
                                <textarea
                                    className="w-full bg-black/20 border border-white/10 rounded p-1 text-xs resize-none h-16 mt-0.5"
                                    value={step.carryForward || ''}
                                    onChange={(e) => onChange({ ...step, carryForward: e.target.value })}
                                />
                            </div>
                        </>
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
                                                onChange={(e) => onChange({ ...step, onPass: e.target.value })}
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
                            ) : (
                                <div>
                                    <label className="text-[9px] uppercase font-bold text-green-400">Next Step →</label>
                                    <select
                                        className="w-full bg-black/20 border border-green-500/20 rounded p-1 text-[10px] mt-0.5"
                                        value={step.nextStep || ''}
                                        onChange={(e) => onChange({ ...step, nextStep: e.target.value })}
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
                                className="w-full h-64 bg-black/40 border border-white/10 rounded-lg p-3 font-mono text-sm resize-none focus:border-primary/50 outline-none"
                                value={step.conditionCode || ''}
                                onChange={(e) => onChange({ ...step, conditionCode: e.target.value })}
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
    return (
        <div className="relative z-20">
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

                // 1. Next Step / On Pass (GREEN ARROW)
                const nextId = step.onPass || step.nextStep;
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
                                strokeWidth="1.5"
                                fill="none"
                                markerEnd="url(#arrowhead-green)"
                                className="transition-all duration-300"
                            />
                        );
                    }
                } else {
                    // Implicit linear next in the same thread?
                    // User said: "no arrows going through the main thread... green arrows always showing where the next step is"
                    // If nextStep is empty, it usually implies the next step in colIndex order.
                    const sameLevel = steps.filter(s => s.subThreadLevel === step.subThreadLevel).sort((a, b) => a.colIndex - b.colIndex);
                    const idx = sameLevel.findIndex(s => s.id === step.id);
                    if (idx !== -1 && idx < sameLevel.length - 1) {
                        const next = sameLevel[idx + 1];
                        const end = getCoords(next);
                        const endX = end.x + TX;
                        const endY = end.y + TY;

                        const cx1 = startX + 50;
                        const cy1 = startY;
                        const cx2 = endX - 50;
                        const cy2 = endY;

                        lines.push(
                            <path
                                key={`implicit-${step.id}`}
                                d={`M ${startX} ${startY} C ${cx1} ${cy1} ${cx2} ${cy2} ${endX} ${endY}`}
                                stroke="#4ade80"
                                strokeWidth="1.5"
                                fill="none"
                                strokeOpacity="0.3" // Faded for implicit
                                markerEnd="url(#arrowhead-green)"
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
                                strokeWidth="1.5"
                                fill="none"
                                markerEnd="url(#arrowhead-red)"
                                opacity="0.95"
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

export function HorizontalStepFlow({ flow, onChange }: { flow: Flow, onChange: (f: Flow) => void }) {
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const dragOrigin = useRef<{ x: number, y: number } | null>(null);
    const chainIds = useRef<string[]>([]);

    const steps = useMemo(() => normalizeLayout(flow.steps), [flow.steps]);

    const maxLevel = Math.max(0, ...steps.map(s => s.subThreadLevel ?? 0));
    const canvasHeight = (maxLevel + 2) * ROW_HEIGHT;

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

        const deltaCol = Math.round(dragOffset.x / COL_WIDTH);

        if (deltaCol !== 0) {
            const chain = chainIds.current;
            const newSteps = steps.map(s => {
                if (chain.includes(s.id)) {
                    let newCol = Math.max(0, (s.colIndex ?? 0) + deltaCol);
                    return { ...s, colIndex: newCol };
                }
                return s;
            });
            onChange({ ...flow, steps: newSteps });
        }

        setDraggingId(null);
        setDragOffset({ x: 0, y: 0 });
        chainIds.current = [];
    }, [draggingId, dragOffset, steps, flow, onChange]);

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
            <div className="flex-1 overflow-auto relative cursor-grab active:cursor-grabbing" style={{ minHeight: canvasHeight }}>
                <div className="absolute inset-0 min-w-[4000px] min-h-[2000px]">
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
                            <div key={lvl} className="absolute z-10" style={{ transform: `translate(${vX}px, ${vY}px)` }}>
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
