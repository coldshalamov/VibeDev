// =============================================================================
// Workflow Editor - Unified Linear Block Editor
// =============================================================================
// A simple, linear editor for creating AI workflows with three block types:
// - PROMPT: Structured instruction for the model
// - BREAKPOINT: Start fresh thread with clean context
// - CONDITION: Logic gate (hard=script, soft=LLM judgment)

import { useState, useCallback, useRef } from 'react';
import { useClickOutside } from '@/hooks/useClickOutside';
import { cn } from '@/lib/utils';
import {
    PlusIcon,
    TrashIcon,
    ChevronDownIcon,
    ChevronUpIcon,
    XMarkIcon,
    ArrowDownIcon,
    ArrowPathIcon,
    DocumentArrowDownIcon,
} from '@heroicons/react/24/outline';

// =============================================================================
// Types
// =============================================================================

export type PromptBlock = {
    type: 'PROMPT';
    id: string;
    title: string;
    role: string;
    context: string;
    task: string;
    guardrails: string;
    deliverables: string;
};

export type BreakpointBlock = {
    type: 'BREAKPOINT';
    id: string;
    reason: string;
    carryForward: string;
};

export type ConditionBlock = {
    type: 'CONDITION';
    id: string;
    title: string;
    mode: 'hard' | 'soft';
    criterion: string;
    onPass: string;
    onFail: string;
    failLoopTarget?: string; // ID of block to return to after fix
};

export type WorkflowBlock = PromptBlock | BreakpointBlock | ConditionBlock;

export type Workflow = {
    name: string;
    version: string;
    description: string;
    blocks: WorkflowBlock[];
};

// =============================================================================
// Serialization (YAML-like Markdown)
// =============================================================================

export function workflowToMarkdown(workflow: Workflow): string {
    const lines: string[] = [
        `# ${workflow.name}`,
        `> Version: ${workflow.version}`,
        '',
        workflow.description,
        '',
        '---',
        '',
    ];

    for (const block of workflow.blocks) {
        if (block.type === 'PROMPT') {
            lines.push(`## PROMPT: ${block.title}`);
            lines.push('');
            lines.push('### Role');
            lines.push(block.role || '_Not specified_');
            lines.push('');
            lines.push('### Context');
            lines.push(block.context || '_Not specified_');
            lines.push('');
            lines.push('### Task');
            lines.push(block.task || '_Not specified_');
            lines.push('');
            lines.push('### Guardrails');
            lines.push(block.guardrails || '_None_');
            lines.push('');
            lines.push('### Deliverables');
            lines.push(block.deliverables || '_Not specified_');
            lines.push('');
            lines.push('---');
            lines.push('');
        } else if (block.type === 'BREAKPOINT') {
            lines.push('## ⏸ BREAKPOINT');
            lines.push('');
            lines.push(`**Reason:** ${block.reason || 'Start fresh context'}`);
            lines.push('');
            lines.push('**Carry Forward:**');
            lines.push(block.carryForward || '_Nothing specified_');
            lines.push('');
            lines.push('---');
            lines.push('');
        } else if (block.type === 'CONDITION') {
            lines.push(`## ⚡ CONDITION: ${block.title}`);
            lines.push('');
            lines.push(`**Mode:** ${block.mode === 'hard' ? '🔧 Hard (Script)' : '🧠 Soft (LLM)'}`);
            lines.push('');
            lines.push('**Criterion:**');
            lines.push('```');
            lines.push(block.criterion || '# No criterion specified');
            lines.push('```');
            lines.push('');
            lines.push(`**On Pass:** ${block.onPass || 'Continue'}`);
            lines.push('');
            lines.push(`**On Fail:** ${block.onFail || 'Stop'}`);
            if (block.failLoopTarget) {
                lines.push(`  - Return to: \`${block.failLoopTarget}\``);
            }
            lines.push('');
            lines.push('---');
            lines.push('');
        }
    }

    return lines.join('\n');
}

export function workflowToXML(workflow: Workflow): string {
    // For actual injection into the model
    const lines: string[] = [];

    for (const block of workflow.blocks) {
        if (block.type === 'PROMPT') {
            lines.push(`<prompt id="${block.id}" title="${block.title}">`);
            lines.push(`  <role>${block.role}</role>`);
            lines.push(`  <context>${block.context}</context>`);
            lines.push(`  <task>${block.task}</task>`);
            lines.push(`  <guardrails>${block.guardrails}</guardrails>`);
            lines.push(`  <deliverables>${block.deliverables}</deliverables>`);
            lines.push('</prompt>');
            lines.push('');
        } else if (block.type === 'BREAKPOINT') {
            lines.push(`<breakpoint reason="${block.reason}">`);
            lines.push(`  <carry_forward>${block.carryForward}</carry_forward>`);
            lines.push('</breakpoint>');
            lines.push('');
        } else if (block.type === 'CONDITION') {
            lines.push(`<condition id="${block.id}" mode="${block.mode}">`);
            lines.push(`  <criterion>${block.criterion}</criterion>`);
            lines.push(`  <on_pass>${block.onPass}</on_pass>`);
            lines.push(`  <on_fail return_to="${block.failLoopTarget || ''}">${block.onFail}</on_fail>`);
            lines.push('</condition>');
            lines.push('');
        }
    }

    return lines.join('\n');
}

// =============================================================================
// Block Components
// =============================================================================

function PromptBlockEditor({
    block,
    onChange,
    onDelete,
    onMoveUp,
    onMoveDown,
    isFirst,
    isLast,
}: {
    block: PromptBlock;
    onChange: (block: PromptBlock) => void;
    onDelete: () => void;
    onMoveUp: () => void;
    onMoveDown: () => void;
    isFirst: boolean;
    isLast: boolean;
}) {
    const [expanded, setExpanded] = useState(true);
    const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
    const deleteRef = useRef<HTMLDivElement>(null);
    useClickOutside(deleteRef, () => setIsConfirmingDelete(false));

    return (
        <div className="rounded-xl border border-primary/30 bg-primary/5 overflow-hidden" ref={deleteRef}>
            {/* Header */}
            <div
                className="flex items-center justify-between p-3 cursor-pointer hover:bg-primary/10 transition-colors"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                        P
                    </div>
                    <input
                        className="bg-transparent font-bold text-white focus:outline-none focus:ring-1 focus:ring-primary/40 rounded px-2 py-1"
                        value={block.title}
                        onChange={(e) => onChange({ ...block, title: e.target.value })}
                        onClick={(e) => e.stopPropagation()}
                        placeholder="Prompt Title"
                    />
                </div>
                <div className="flex items-center gap-1">
                    {!isFirst && (
                        <button onClick={(e) => { e.stopPropagation(); onMoveUp(); }} className="p-1 hover:bg-white/10 rounded">
                            <ChevronUpIcon className="w-4 h-4" />
                        </button>
                    )}
                    {!isLast && (
                        <button onClick={(e) => { e.stopPropagation(); onMoveDown(); }} className="p-1 hover:bg-white/10 rounded">
                            <ChevronDownIcon className="w-4 h-4" />
                        </button>
                    )}
                    {isConfirmingDelete ? (
                        <div className="flex items-center gap-1 animate-in fade-in slide-in-from-right-1 duration-200">
                            <span className="text-[9px] font-bold text-red-400 uppercase tracking-tighter">Sure?</span>
                            <button
                                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                                className="p-1 bg-red-500/20 hover:bg-red-500 text-white rounded transition-all"
                                title="Yes, delete"
                            >
                                <TrashIcon className="w-4 h-4" />
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); setIsConfirmingDelete(false); }}
                                className="p-1 hover:bg-white/10 text-muted-foreground rounded"
                                title="Cancel"
                            >
                                <XMarkIcon className="w-4 h-4" />
                            </button>
                        </div>
                    ) : (
                        <button onClick={(e) => { e.stopPropagation(); setIsConfirmingDelete(true); }} className="p-1 hover:bg-red-500/20 text-red-400 rounded">
                            <TrashIcon className="w-4 h-4" />
                        </button>
                    )}
                    {expanded ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
                </div>
            </div>

            {/* Body */}
            {expanded && (
                <div className="p-4 space-y-4 border-t border-primary/20">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] uppercase tracking-wider text-primary/70 font-bold mb-1">Role</label>
                            <textarea
                                className="w-full bg-black/30 border border-white/10 rounded-lg p-2 text-sm resize-none h-20 focus:border-primary/40 focus:outline-none"
                                value={block.role}
                                onChange={(e) => onChange({ ...block, role: e.target.value })}
                                placeholder="You are a senior software engineer..."
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] uppercase tracking-wider text-primary/70 font-bold mb-1">Context</label>
                            <textarea
                                className="w-full bg-black/30 border border-white/10 rounded-lg p-2 text-sm resize-none h-20 focus:border-primary/40 focus:outline-none"
                                value={block.context}
                                onChange={(e) => onChange({ ...block, context: e.target.value })}
                                placeholder="Repository: ...\nKey files: ..."
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-[10px] uppercase tracking-wider text-primary/70 font-bold mb-1">Task</label>
                        <textarea
                            className="w-full bg-black/30 border border-white/10 rounded-lg p-2 text-sm resize-none h-24 focus:border-primary/40 focus:outline-none"
                            value={block.task}
                            onChange={(e) => onChange({ ...block, task: e.target.value })}
                            placeholder="What should the model do? Be specific..."
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] uppercase tracking-wider text-primary/70 font-bold mb-1">Guardrails</label>
                            <textarea
                                className="w-full bg-black/30 border border-white/10 rounded-lg p-2 text-sm resize-none h-20 focus:border-primary/40 focus:outline-none"
                                value={block.guardrails}
                                onChange={(e) => onChange({ ...block, guardrails: e.target.value })}
                                placeholder="- Don't modify tests\n- Keep changes minimal"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] uppercase tracking-wider text-primary/70 font-bold mb-1">Deliverables</label>
                            <textarea
                                className="w-full bg-black/30 border border-white/10 rounded-lg p-2 text-sm resize-none h-20 focus:border-primary/40 focus:outline-none"
                                value={block.deliverables}
                                onChange={(e) => onChange({ ...block, deliverables: e.target.value })}
                                placeholder="- Modified files\n- Explanation"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function BreakpointBlockEditor({
    block,
    onChange,
    onDelete,
    onMoveUp,
    onMoveDown,
    isFirst,
    isLast,
}: {
    block: BreakpointBlock;
    onChange: (block: BreakpointBlock) => void;
    onDelete: () => void;
    onMoveUp: () => void;
    onMoveDown: () => void;
    isFirst: boolean;
    isLast: boolean;
}) {
    const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
    const deleteRef = useRef<HTMLDivElement>(null);
    useClickOutside(deleteRef, () => setIsConfirmingDelete(false));

    return (
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 overflow-hidden" ref={deleteRef}>
            <div className="flex items-center justify-between p-3">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-yellow-500/20 flex items-center justify-center text-yellow-400 font-bold text-sm">
                        ⏸
                    </div>
                    <span className="font-bold text-yellow-300">BREAKPOINT</span>
                    <span className="text-xs text-muted-foreground">— New thread, fresh context</span>
                </div>
                <div className="flex items-center gap-1">
                    {!isFirst && (
                        <button onClick={onMoveUp} className="p-1 hover:bg-white/10 rounded">
                            <ChevronUpIcon className="w-4 h-4" />
                        </button>
                    )}
                    {!isLast && (
                        <button onClick={onMoveDown} className="p-1 hover:bg-white/10 rounded">
                            <ChevronDownIcon className="w-4 h-4" />
                        </button>
                    )}
                    {isConfirmingDelete ? (
                        <div className="flex items-center gap-1 animate-in fade-in slide-in-from-right-1 duration-200">
                            <span className="text-[9px] font-bold text-red-400 uppercase tracking-tighter">Sure?</span>
                            <button
                                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                                className="p-1 bg-red-500/20 hover:bg-red-500 text-white rounded transition-all"
                                title="Yes, delete"
                            >
                                <TrashIcon className="w-4 h-4" />
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); setIsConfirmingDelete(false); }}
                                className="p-1 hover:bg-white/10 text-muted-foreground rounded"
                                title="Cancel"
                            >
                                <XMarkIcon className="w-4 h-4" />
                            </button>
                        </div>
                    ) : (
                        <button onClick={(e) => { e.stopPropagation(); setIsConfirmingDelete(true); }} className="p-1 hover:bg-red-500/20 text-red-400 rounded">
                            <TrashIcon className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>
            <div className="p-4 border-t border-yellow-500/20 grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-[10px] uppercase tracking-wider text-yellow-500/70 font-bold mb-1">Reason</label>
                    <input
                        className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-yellow-500/40 focus:outline-none"
                        value={block.reason}
                        onChange={(e) => onChange({ ...block, reason: e.target.value })}
                        placeholder="Why start fresh? (e.g., 'Research complete')"
                    />
                </div>
                <div>
                    <label className="block text-[10px] uppercase tracking-wider text-yellow-500/70 font-bold mb-1">Carry Forward</label>
                    <input
                        className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-yellow-500/40 focus:outline-none"
                        value={block.carryForward}
                        onChange={(e) => onChange({ ...block, carryForward: e.target.value })}
                        placeholder="What to preserve (e.g., 'Key findings, file paths')"
                    />
                </div>
            </div>
        </div>
    );
}

function ConditionBlockEditor({
    block,
    onChange,
    onDelete,
    onMoveUp,
    onMoveDown,
    isFirst,
    isLast,
    allBlocks,
}: {
    block: ConditionBlock;
    onChange: (block: ConditionBlock) => void;
    onDelete: () => void;
    onMoveUp: () => void;
    onMoveDown: () => void;
    isFirst: boolean;
    isLast: boolean;
    allBlocks: WorkflowBlock[];
}) {
    const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
    const deleteRef = useRef<HTMLDivElement>(null);
    useClickOutside(deleteRef, () => setIsConfirmingDelete(false));

    return (
        <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 overflow-hidden" ref={deleteRef}>
            <div className="flex items-center justify-between p-3">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-400 font-bold text-sm">
                        ⚡
                    </div>
                    <input
                        className="bg-transparent font-bold text-purple-300 focus:outline-none focus:ring-1 focus:ring-purple-500/40 rounded px-2 py-1"
                        value={block.title}
                        onChange={(e) => onChange({ ...block, title: e.target.value })}
                        placeholder="Condition Name"
                    />
                </div>
                <div className="flex items-center gap-1">
                    {!isFirst && (
                        <button onClick={onMoveUp} className="p-1 hover:bg-white/10 rounded">
                            <ChevronUpIcon className="w-4 h-4" />
                        </button>
                    )}
                    {!isLast && (
                        <button onClick={onMoveDown} className="p-1 hover:bg-white/10 rounded">
                            <ChevronDownIcon className="w-4 h-4" />
                        </button>
                    )}
                    {isConfirmingDelete ? (
                        <div className="flex items-center gap-1 animate-in fade-in slide-in-from-right-1 duration-200">
                            <span className="text-[9px] font-bold text-red-400 uppercase tracking-tighter">Sure?</span>
                            <button
                                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                                className="p-1 bg-red-500/20 hover:bg-red-500 text-white rounded transition-all"
                                title="Yes, delete"
                            >
                                <TrashIcon className="w-4 h-4" />
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); setIsConfirmingDelete(false); }}
                                className="p-1 hover:bg-white/10 text-muted-foreground rounded"
                                title="Cancel"
                            >
                                <XMarkIcon className="w-4 h-4" />
                            </button>
                        </div>
                    ) : (
                        <button onClick={(e) => { e.stopPropagation(); setIsConfirmingDelete(true); }} className="p-1 hover:bg-red-500/20 text-red-400 rounded">
                            <TrashIcon className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            <div className="p-4 border-t border-purple-500/20 space-y-4">
                {/* Mode Toggle */}
                <div className="flex items-center gap-4">
                    <label className="text-[10px] uppercase tracking-wider text-purple-400/70 font-bold">Mode:</label>
                    <div className="flex bg-black/30 rounded-lg p-1 border border-white/10">
                        <button
                            onClick={() => onChange({ ...block, mode: 'hard' })}
                            className={cn(
                                "px-3 py-1 text-xs rounded-md transition-all",
                                block.mode === 'hard' ? "bg-purple-500/30 text-purple-300" : "text-muted-foreground hover:text-white"
                            )}
                        >
                            🔧 Hard (Script)
                        </button>
                        <button
                            onClick={() => onChange({ ...block, mode: 'soft' })}
                            className={cn(
                                "px-3 py-1 text-xs rounded-md transition-all",
                                block.mode === 'soft' ? "bg-purple-500/30 text-purple-300" : "text-muted-foreground hover:text-white"
                            )}
                        >
                            🧠 Soft (LLM)
                        </button>
                    </div>
                </div>

                {/* Criterion */}
                <div>
                    <label className="block text-[10px] uppercase tracking-wider text-purple-400/70 font-bold mb-1">
                        {block.mode === 'hard' ? 'Script / Command' : 'Question for LLM'}
                    </label>
                    <textarea
                        className="w-full bg-black/30 border border-white/10 rounded-lg p-2 text-sm font-mono resize-none h-16 focus:border-purple-500/40 focus:outline-none"
                        value={block.criterion}
                        onChange={(e) => onChange({ ...block, criterion: e.target.value })}
                        placeholder={block.mode === 'hard' ? 'pytest tests/ -q' : 'Does this implementation meet the requirements?'}
                    />
                </div>

                {/* Pass/Fail */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                        <label className="block text-[10px] uppercase tracking-wider text-green-400 font-bold mb-1">✓ On Pass</label>
                        <input
                            className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-green-500/40 focus:outline-none"
                            value={block.onPass}
                            onChange={(e) => onChange({ ...block, onPass: e.target.value })}
                            placeholder="Continue to next block"
                        />
                    </div>
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                        <label className="block text-[10px] uppercase tracking-wider text-red-400 font-bold mb-1">✗ On Fail</label>
                        <input
                            className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-red-500/40 focus:outline-none"
                            value={block.onFail}
                            onChange={(e) => onChange({ ...block, onFail: e.target.value })}
                            placeholder="Run fix prompt, then retry"
                        />
                        <div className="mt-2 flex items-center gap-2">
                            <ArrowPathIcon className="w-3 h-3 text-muted-foreground" />
                            <select
                                className="flex-1 bg-black/30 border border-white/10 rounded px-2 py-1 text-xs focus:border-red-500/40 focus:outline-none"
                                value={block.failLoopTarget || ''}
                                onChange={(e) => onChange({ ...block, failLoopTarget: e.target.value || undefined })}
                            >
                                <option value="">No loop (stop on fail)</option>
                                {allBlocks.filter(b => b.id !== block.id).map(b => (
                                    <option key={b.id} value={b.id}>
                                        Return to: {b.type === 'PROMPT' ? (b as PromptBlock).title : b.type === 'CONDITION' ? (b as ConditionBlock).title : 'Breakpoint'}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// =============================================================================
// Add Block Dropdown
// =============================================================================

function AddBlockButton({ onAdd }: { onAdd: (type: WorkflowBlock['type']) => void }) {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    useClickOutside(containerRef, () => setOpen(false));

    return (
        <div className="relative" ref={containerRef}>
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-white/10 hover:border-primary/40 rounded-xl text-muted-foreground hover:text-primary transition-all group"
            >
                <PlusIcon className="w-5 h-5" />
                <span className="text-sm font-medium">Add Block</span>
            </button>

            {open && (
                <div className="absolute left-1/2 -translate-x-1/2 mt-2 w-64 bg-card border border-white/10 rounded-xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <button
                        onClick={() => { onAdd('PROMPT'); setOpen(false); }}
                        className="w-full flex items-center gap-3 p-3 hover:bg-primary/10 transition-colors text-left"
                    >
                        <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary font-bold">P</div>
                        <div>
                            <div className="font-bold text-sm">Prompt</div>
                            <div className="text-xs text-muted-foreground">Instruction with role, context, task</div>
                        </div>
                    </button>
                    <button
                        onClick={() => { onAdd('BREAKPOINT'); setOpen(false); }}
                        className="w-full flex items-center gap-3 p-3 hover:bg-yellow-500/10 transition-colors text-left border-t border-white/5"
                    >
                        <div className="w-8 h-8 rounded-lg bg-yellow-500/20 flex items-center justify-center text-yellow-400 font-bold">⏸</div>
                        <div>
                            <div className="font-bold text-sm">Breakpoint</div>
                            <div className="text-xs text-muted-foreground">Start new thread with fresh context</div>
                        </div>
                    </button>
                    <button
                        onClick={() => { onAdd('CONDITION'); setOpen(false); }}
                        className="w-full flex items-center gap-3 p-3 hover:bg-purple-500/10 transition-colors text-left border-t border-white/5"
                    >
                        <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-400 font-bold">⚡</div>
                        <div>
                            <div className="font-bold text-sm">Condition</div>
                            <div className="text-xs text-muted-foreground">Logic gate with pass/fail branches</div>
                        </div>
                    </button>
                </div>
            )}
        </div>
    );
}

// =============================================================================
// Main Component
// =============================================================================

type WorkflowEditorProps = {
    workflow: Workflow;
    onChange: (workflow: Workflow) => void;
    onExport?: (format: 'md' | 'xml') => void;
    onImport?: (file: File) => void;
};

export function WorkflowEditor({ workflow, onChange, onExport, onImport }: WorkflowEditorProps) {
    void onExport;
    void onImport;

    const generateId = () => `block_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const addBlock = useCallback((type: WorkflowBlock['type']) => {
        let newBlock: WorkflowBlock;
        if (type === 'PROMPT') {
            newBlock = {
                type: 'PROMPT',
                id: generateId(),
                title: 'New Prompt',
                role: '',
                context: '',
                task: '',
                guardrails: '',
                deliverables: '',
            };
        } else if (type === 'BREAKPOINT') {
            newBlock = {
                type: 'BREAKPOINT',
                id: generateId(),
                reason: '',
                carryForward: '',
            };
        } else {
            newBlock = {
                type: 'CONDITION',
                id: generateId(),
                title: 'New Condition',
                mode: 'hard',
                criterion: '',
                onPass: 'Continue',
                onFail: 'Fix and retry',
            };
        }
        onChange({ ...workflow, blocks: [...workflow.blocks, newBlock] });
    }, [workflow, onChange]);

    const updateBlock = useCallback((index: number, block: WorkflowBlock) => {
        const newBlocks = [...workflow.blocks];
        newBlocks[index] = block;
        onChange({ ...workflow, blocks: newBlocks });
    }, [workflow, onChange]);

    const deleteBlock = useCallback((index: number) => {
        onChange({ ...workflow, blocks: workflow.blocks.filter((_, i) => i !== index) });
    }, [workflow, onChange]);

    const moveBlock = useCallback((index: number, direction: 'up' | 'down') => {
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= workflow.blocks.length) return;
        const newBlocks = [...workflow.blocks];
        [newBlocks[index], newBlocks[newIndex]] = [newBlocks[newIndex], newBlocks[index]];
        onChange({ ...workflow, blocks: newBlocks });
    }, [workflow, onChange]);

    const handleExportMd = () => {
        const md = workflowToMarkdown(workflow);
        const blob = new Blob([md], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${workflow.name.replace(/\s+/g, '_').toLowerCase()}.md`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/5">
                <div className="flex-1">
                    <input
                        className="text-xl font-bold bg-transparent focus:outline-none focus:ring-1 focus:ring-primary/40 rounded px-2 py-1 w-full max-w-md"
                        value={workflow.name}
                        onChange={(e) => onChange({ ...workflow, name: e.target.value })}
                        placeholder="Workflow Name"
                    />
                    <input
                        className="text-sm text-muted-foreground bg-transparent focus:outline-none focus:ring-1 focus:ring-primary/40 rounded px-2 py-1 mt-1 w-full max-w-lg"
                        value={workflow.description}
                        onChange={(e) => onChange({ ...workflow, description: e.target.value })}
                        placeholder="Describe this workflow..."
                    />
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleExportMd}
                        className="btn btn-outline text-xs flex items-center gap-2"
                    >
                        <DocumentArrowDownIcon className="w-4 h-4" />
                        Export .md
                    </button>
                    <span className="text-xs text-muted-foreground font-mono">
                        {workflow.blocks.length} blocks
                    </span>
                </div>
            </div>

            {/* Blocks */}
            <div className="flex-1 overflow-auto p-4">
                <div className="max-w-3xl mx-auto space-y-4">
                    {workflow.blocks.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <div className="text-4xl mb-4">📝</div>
                            <p className="text-lg font-medium">No blocks yet</p>
                            <p className="text-sm">Click the button below to add your first block</p>
                        </div>
                    ) : (
                        workflow.blocks.map((block, index) => (
                            <div key={block.id}>
                                {block.type === 'PROMPT' && (
                                    <PromptBlockEditor
                                        block={block}
                                        onChange={(b) => updateBlock(index, b)}
                                        onDelete={() => deleteBlock(index)}
                                        onMoveUp={() => moveBlock(index, 'up')}
                                        onMoveDown={() => moveBlock(index, 'down')}
                                        isFirst={index === 0}
                                        isLast={index === workflow.blocks.length - 1}
                                    />
                                )}
                                {block.type === 'BREAKPOINT' && (
                                    <BreakpointBlockEditor
                                        block={block}
                                        onChange={(b) => updateBlock(index, b)}
                                        onDelete={() => deleteBlock(index)}
                                        onMoveUp={() => moveBlock(index, 'up')}
                                        onMoveDown={() => moveBlock(index, 'down')}
                                        isFirst={index === 0}
                                        isLast={index === workflow.blocks.length - 1}
                                    />
                                )}
                                {block.type === 'CONDITION' && (
                                    <ConditionBlockEditor
                                        block={block}
                                        onChange={(b) => updateBlock(index, b)}
                                        onDelete={() => deleteBlock(index)}
                                        onMoveUp={() => moveBlock(index, 'up')}
                                        onMoveDown={() => moveBlock(index, 'down')}
                                        isFirst={index === 0}
                                        isLast={index === workflow.blocks.length - 1}
                                        allBlocks={workflow.blocks}
                                    />
                                )}

                                {/* Connector */}
                                {index < workflow.blocks.length - 1 && (
                                    <div className="flex justify-center py-2">
                                        <ArrowDownIcon className="w-5 h-5 text-muted-foreground/50" />
                                    </div>
                                )}
                            </div>
                        ))
                    )}

                    <AddBlockButton onAdd={addBlock} />
                </div>
            </div>
        </div>
    );
}

export default WorkflowEditor;
