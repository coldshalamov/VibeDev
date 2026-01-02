// =============================================================================
// Unified Workflow View - Uses Horizontal Step Flow
// =============================================================================

import { useState, useEffect } from 'react';
import { HorizontalStepFlow, type Flow } from './HorizontalStepFlow';
import { useVibeDevStore } from '@/stores/useVibeDevStore';

const PHASE_LABELS: Record<string, { title: string; description: string }> = {
    research: {
        title: 'Research',
        description: 'Explore the codebase and gather context',
    },
    planning: {
        title: 'Planning',
        description: 'Design the implementation strategy',
    },
    execution: {
        title: 'Execution',
        description: 'Implement the actual changes',
    },
    review: {
        title: 'Review',
        description: 'Verify and clean up',
    },
};

const DEFAULT_FLOW: Flow = {
    name: '',
    description: '',
    steps: [],
    globalContext: '',
};

type Props = {
    phase?: 'research' | 'planning' | 'execution' | 'review';
};

export function UnifiedWorkflowView({ phase }: Props) {
    const currentJobId = useVibeDevStore((state) => state.currentJobId);
    const uiState = useVibeDevStore((state) => state.uiState);

    const storageKey = `vibedev-flow-${currentJobId}-${phase || 'all'}`;

    const [flow, setFlow] = useState<Flow>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(storageKey);
            if (saved) {
                try { return JSON.parse(saved); } catch { }
            }
        }
        const phaseInfo = phase ? PHASE_LABELS[phase] : null;
        return {
            ...DEFAULT_FLOW,
            name: phaseInfo?.title || uiState?.job?.title || 'Workflow',
            description: phaseInfo?.description || uiState?.job?.goal || '',
        };
    });

    useEffect(() => {
        if (currentJobId) {
            localStorage.setItem(storageKey, JSON.stringify(flow));
        }
    }, [flow, storageKey, currentJobId]);

    if (!currentJobId || !uiState) {
        return (
            <div className="flex h-full items-center justify-center text-muted-foreground/60">
                <div className="text-center">
                    <div className="text-4xl mb-4">🚀</div>
                    <p className="text-lg font-medium">No active job</p>
                    <p className="text-sm">Create or select a job to start</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex">
            {/* Main Editor */}
            <div className="flex-1">
                <HorizontalStepFlow flow={flow} onChange={setFlow} />
            </div>

            {/* Global Context Sidebar */}
            <div className="w-72 border-l border-white/5 bg-card/30 flex flex-col">
                <div className="p-3 border-b border-white/5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Global Context
                    </h3>
                    <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                        Injected into every prompt
                    </p>
                </div>
                <div className="flex-1 p-3">
                    <textarea
                        value={flow.globalContext}
                        onChange={(e) => setFlow({ ...flow, globalContext: e.target.value })}
                        placeholder={`Repo: ${uiState.job.repo_root || '/path/to/repo'}

Files:
- src/
- tests/

Invariants:
- Don't break tests
- Follow code style`}
                        className="w-full h-full bg-black/30 border border-white/10 rounded-lg p-2 text-[11px] font-mono resize-none focus:border-primary/40 focus:outline-none"
                    />
                </div>
            </div>
        </div>
    );
}

export default UnifiedWorkflowView;
