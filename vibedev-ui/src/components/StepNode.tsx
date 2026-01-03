import { memo, useState, useRef } from 'react';
import { useClickOutside } from '@/hooks/useClickOutside';
import { Handle, Position, type Node, NodeProps } from '@xyflow/react';
import { cn } from '@/lib/utils';
import {
    PencilSquareIcon,
    TrashIcon,
    CheckCircleIcon,
    DocumentMagnifyingGlassIcon
} from '@heroicons/react/24/outline';

export type StepNodeData = {
    title: string;
    description?: string;
    instruction?: string;
    acceptance_criteria?: string;
    required_evidence?: string;
    isStart?: boolean;
    isEnd?: boolean;
    status?: string | 'PENDING' | 'ACTIVE' | 'DONE' | 'SKIPPED';
    onChange?: (data: Partial<StepNodeData>) => void;
    onDelete?: () => void;
};

export type StepFlowNode = Node<StepNodeData, 'step'>;

export const StepNode = memo(({ data, selected }: NodeProps<StepFlowNode>) => {
    const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
    const deleteRef = useRef<HTMLDivElement>(null);
    useClickOutside(deleteRef, () => setIsConfirmingDelete(false));

    return (
        <div
            ref={deleteRef}
            className={cn(
                "glass-panel rounded-xl border-2 transition-all duration-300 min-w-[250px] shadow-lg animate-fade-in",
                selected ? "border-primary ring-2 ring-primary/20 bg-black/40" : "border-white/10 hover:border-white/30 bg-black/20",
                data.status === 'DONE' && "border-green-500/50 shadow-green-500/10",
                data.status === 'ACTIVE' && "border-blue-500 shadow-blue-500/20",
                data.status === 'SKIPPED' && "opacity-50 grayscale"
            )}>
            {/* Input Handle */}
            {!data.isStart && (
                <Handle
                    type="target"
                    position={Position.Top}
                    className="w-3 h-3 border-2 border-primary bg-background !-top-1.5 transition-all hover:w-4 hover:h-4"
                />
            )}

            {/* Header */}
            <div className={cn(
                "p-3 border-b border-white/10 flex items-center justify-between rounded-t-xl",
                selected ? "bg-primary/10" : "bg-white/5"
            )}>
                <div className="flex items-center gap-2">
                    <div className={cn(
                        "w-2 h-2 rounded-full",
                        data.status === 'DONE' ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]" :
                            data.status === 'ACTIVE' ? "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)] animate-pulse" :
                                data.status === 'SKIPPED' ? "bg-gray-500" :
                                    data.isStart ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]" :
                                        data.isEnd ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" :
                                            "bg-blue-500/50 shadow-[0_0_8px_rgba(59,130,246,0.4)]"
                    )} />
                    <input
                        className="bg-transparent border-none text-sm font-bold focus:ring-0 w-full text-white placeholder:text-muted-foreground/50"
                        value={data.title}
                        onChange={(e) => data.onChange?.({ title: e.target.value })}
                        placeholder="Step Title"
                    />
                </div>
                {data.onDelete && !data.isStart && (
                    <div className="flex items-center">
                        {isConfirmingDelete ? (
                            <div className="flex items-center gap-1 animate-in fade-in slide-in-from-right-1 duration-200">
                                <span className="text-[9px] font-bold text-red-400 uppercase tracking-tighter">Sure?</span>
                                <button
                                    onClick={(e) => { e.stopPropagation(); data.onDelete?.(); }}
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
                                    <span className="text-xs px-1">✕</span>
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={(e) => { e.stopPropagation(); setIsConfirmingDelete(true); }}
                                className="text-muted-foreground hover:text-red-400 transition-colors p-1 rounded hover:bg-white/5"
                                title="Delete step"
                            >
                                <TrashIcon className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Body */}
            <div className="p-3 space-y-3">
                {/* Instruction Snippet */}
                <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                        <PencilSquareIcon className="w-3 h-3" /> Instruction
                    </label>
                    <textarea
                        className="w-full bg-black/20 border border-white/10 rounded-md p-2 text-xs font-mono h-16 resize-none focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20 text-muted-foreground placeholder:text-muted-foreground/30 transition-all focus:h-24"
                        value={data.instruction ?? ''}
                        onChange={(e) => data.onChange?.({ instruction: e.target.value })}
                        placeholder="What should the AI do?"
                    />
                </div>

                {/* Gates (Acceptance Criteria) */}
                <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                        <CheckCircleIcon className="w-3 h-3" /> Gates
                    </label>
                    <textarea
                        className="w-full bg-black/20 border border-white/10 rounded-md p-2 text-xs h-10 resize-none focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20 text-muted-foreground placeholder:text-muted-foreground/30 transition-all focus:h-20"
                        value={data.acceptance_criteria ?? ''}
                        onChange={(e) => data.onChange?.({ acceptance_criteria: e.target.value })}
                        placeholder="One per line..."
                    />
                </div>

                {/* Evidence */}
                <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                        <DocumentMagnifyingGlassIcon className="w-3 h-3" /> Evidence
                    </label>
                    <textarea
                        className="w-full bg-black/20 border border-white/10 rounded-md p-2 text-xs h-10 resize-none focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20 text-muted-foreground placeholder:text-muted-foreground/30 transition-all focus:h-20"
                        value={data.required_evidence ?? ''}
                        onChange={(e) => data.onChange?.({ required_evidence: e.target.value })}
                        placeholder="One per line..."
                    />
                </div>

                <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground cursor-pointer flex items-center gap-2">
                        <input
                            type="checkbox"
                            className="rounded border-white/20 bg-black/40 text-primary focus:ring-primary/40 w-3 h-3 transition-all"
                            checked={data.acceptance_criteria?.includes('human_approval')}
                            onChange={(e) => {
                                const current = data.acceptance_criteria || '';
                                const lines = current.split('\n').filter(l => l.trim() && l !== 'human_approval');
                                if (e.target.checked) {
                                    lines.push('human_approval');
                                }
                                data.onChange?.({ acceptance_criteria: lines.join('\n') });
                            }}
                        />
                        Human Approval
                    </label>
                    {data.acceptance_criteria?.includes('human_approval') && (
                        <div className="text-[9px] text-primary font-bold animate-pulse">GATE ACTIVE</div>
                    )}
                </div>
            </div>

            {/* Output Handles */}
            {!data.isEnd && (
                <div className="relative h-4 flex items-center justify-center">
                    <Handle
                        type="source"
                        position={Position.Bottom}
                        className="w-3 h-3 border-2 border-primary bg-background !-bottom-1.5 transition-all hover:w-4 hover:h-4"
                    />
                </div>
            )}
        </div>
    );
});

StepNode.displayName = "StepNode";
