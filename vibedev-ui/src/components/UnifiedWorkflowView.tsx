// =============================================================================
// Unified Workflow View - Same editor for all phases
// =============================================================================

import { useState, useEffect } from 'react';
import { WorkflowEditor, type Workflow } from './WorkflowEditor';
import { useVibeDevStore } from '@/stores/useVibeDevStore';

const PHASE_LABELS: Record<string, { title: string; description: string }> = {
    research: {
        title: 'Research Phase',
        description: 'Define prompts to explore the codebase and gather context.',
    },
    planning: {
        title: 'Planning Phase',
        description: 'Design the implementation strategy and break down tasks.',
    },
    execution: {
        title: 'Execution Phase',
        description: 'Define the prompts that will implement the actual changes.',
    },
    review: {
        title: 'Review Phase',
        description: 'Verification and cleanup prompts to ensure quality.',
    },
};

const DEFAULT_WORKFLOW: Workflow = {
    name: 'New Workflow',
    version: '1.0',
    description: '',
    blocks: [],
};

type Props = {
    phase?: 'research' | 'planning' | 'execution' | 'review';
};

export function UnifiedWorkflowView({ phase }: Props) {
    const currentJobId = useVibeDevStore((state) => state.currentJobId);
    const uiState = useVibeDevStore((state) => state.uiState);

    // Separate workflow for each phase (stored in localStorage for now)
    const storageKey = `vibedev-workflow-${currentJobId}-${phase || 'all'}`;

    const [workflow, setWorkflow] = useState<Workflow>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(storageKey);
            if (saved) {
                try {
                    return JSON.parse(saved);
                } catch { }
            }
        }
        return {
            ...DEFAULT_WORKFLOW,
            name: phase ? PHASE_LABELS[phase]?.title || 'Workflow' : uiState?.job?.title || 'Workflow',
            description: phase ? PHASE_LABELS[phase]?.description || '' : uiState?.job?.goal || '',
        };
    });

    // Global context that applies to all prompts
    const [globalContext, setGlobalContext] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem(`vibedev-global-context-${currentJobId}`) || '';
        }
        return '';
    });

    // Save to localStorage on change
    useEffect(() => {
        if (currentJobId) {
            localStorage.setItem(storageKey, JSON.stringify(workflow));
        }
    }, [workflow, storageKey, currentJobId]);

    useEffect(() => {
        if (currentJobId) {
            localStorage.setItem(`vibedev-global-context-${currentJobId}`, globalContext);
        }
    }, [globalContext, currentJobId]);

    if (!currentJobId || !uiState) {
        return (
            <div className="flex h-full items-center justify-center text-muted-foreground/60">
                <div className="text-center">
                    <div className="text-4xl mb-4">🚀</div>
                    <p className="text-lg font-medium">No active job</p>
                    <p className="text-sm">Create or select a job to start building your workflow</p>
                </div>
            </div>
        );
    }

    const phaseInfo = phase ? PHASE_LABELS[phase] : null;

    return (
        <div className="h-full flex">
            {/* Main Editor */}
            <div className="flex-1 flex flex-col">
                {phaseInfo && (
                    <div className="px-6 py-4 border-b border-white/5 bg-card/50">
                        <h1 className="text-xl font-bold">{phaseInfo.title}</h1>
                        <p className="text-sm text-muted-foreground">{phaseInfo.description}</p>
                    </div>
                )}
                <div className="flex-1">
                    <WorkflowEditor
                        workflow={workflow}
                        onChange={setWorkflow}
                    />
                </div>
            </div>

            {/* Global Context Sidebar */}
            <div className="w-80 border-l border-white/5 bg-card/30 flex flex-col">
                <div className="p-4 border-b border-white/5">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                        Global Context
                    </h3>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                        Injected into every prompt in this job
                    </p>
                </div>
                <div className="flex-1 p-4">
                    <textarea
                        value={globalContext}
                        onChange={(e) => setGlobalContext(e.target.value)}
                        placeholder={`Repository: ${uiState.job.repo_root || '/path/to/repo'}

Key files:
- src/main.py
- tests/

Invariants:
- Don't break existing tests
- Follow existing code style

Tech stack:
- Python 3.11
- React + TypeScript
- SQLite`}
                        className="w-full h-full bg-black/30 border border-white/10 rounded-lg p-3 text-xs font-mono resize-none focus:border-primary/40 focus:outline-none"
                    />
                </div>
                <div className="p-4 border-t border-white/5">
                    <div className="text-[10px] text-muted-foreground/60 font-mono">
                        This context is automatically prepended to all prompts.
                    </div>
                </div>
            </div>
        </div>
    );
}

export default UnifiedWorkflowView;
