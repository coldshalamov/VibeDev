// =============================================================================
// Unified Workflow View - Uses Horizontal Step Flow
// =============================================================================

import { useMemo, useEffect, useRef, useState } from 'react';
import { HorizontalStepFlow, type Flow } from './HorizontalStepFlow';
import { useVibeDevStore } from '@/stores/useVibeDevStore';
import { compileUnifiedWorkflow, saveUIState } from '@/lib/api';

const PHASE_LABELS: Record<string, { title: string; description: string; icon: string }> = {
    research: {
        title: 'Research',
        description: 'Explore the codebase and gather context',
        icon: '🔍'
    },
    planning: {
        title: 'Planning',
        description: 'Design the implementation strategy',
        icon: '📐'
    },
    execution: {
        title: 'Execution',
        description: 'Implement the actual changes',
        icon: '⚡'
    },
    review: {
        title: 'Review',
        description: 'Verify and clean up',
        icon: '📊'
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
    const setGlobalContext = useVibeDevStore((state) => state.setGlobalContext);

    const saveTimerRef = useRef<number | null>(null);

    const unifiedWorkflowsFromBackend = useMemo(() => {
        const state: any = uiState?.flow_state || null;
        return (state?.unified_workflows || null) as Record<string, Flow> | null;
    }, [uiState?.flow_state]);

    const getPreviousPhaseContext = (currentPhase: string) => {
        const phases = ['research', 'planning', 'execution', 'review'];
        const idx = phases.indexOf(currentPhase);
        if (idx <= 0) return null;

        const prevPhase = phases[idx - 1];
        const prevFlow = unifiedWorkflowsFromBackend?.[prevPhase] as any;
        if (!prevFlow) return null;
        const transitionStep = prevFlow.steps?.find((s: any) => s.nextPhase === currentPhase);
        return transitionStep?.transitionContext || null;
    };

    const [flow, setFlow] = useState<Flow>(() => {
        const phaseInfo = phase ? PHASE_LABELS[phase] : null;
        const prevContext = phase ? getPreviousPhaseContext(phase) : null;

        return {
            ...DEFAULT_FLOW,
            name: phaseInfo?.title || uiState?.job?.title || 'Workflow',
            description: phaseInfo?.description || uiState?.job?.goal || '',
            globalContext: prevContext ? `FROM PREVIOUS PHASE:\n${prevContext}\n\n${DEFAULT_FLOW.globalContext}` : DEFAULT_FLOW.globalContext,
        };
    });

    const stepStatusById = useMemo(() => {
        const map: Record<string, string> = {};
        const steps = (uiState as any)?.steps || [];
        for (const s of steps) {
            if (s?.step_id) map[String(s.step_id)] = String(s.status || 'PENDING');
        }
        return map;
    }, [uiState?.steps]);

    const lockCompletedSteps =
        uiState?.job?.status === 'EXECUTING' ||
        uiState?.job?.status === 'PAUSED' ||
        uiState?.job?.status === 'COMPLETE';

    // Reload flow when phase changes or backend state updates
    useEffect(() => {
        const saved = phase ? unifiedWorkflowsFromBackend?.[phase] : null;
        if (saved) {
            setFlow(saved);
            return;
        }

        // If no saved flow, create a new empty one for this phase
        const phaseInfo = phase ? PHASE_LABELS[phase] : null;
        const prevContext = phase ? getPreviousPhaseContext(phase) : null;

        setFlow({
            ...DEFAULT_FLOW,
            name: phaseInfo?.title || uiState?.job?.title || 'Workflow',
            description: phaseInfo?.description || uiState?.job?.goal || '',
            globalContext: prevContext ? `FROM PREVIOUS PHASE:\n${prevContext}\n\n${DEFAULT_FLOW.globalContext}` : DEFAULT_FLOW.globalContext,
        });
    }, [phase, uiState?.job?.goal, uiState?.job?.title, unifiedWorkflowsFromBackend]);

    // Sync globalContext to store for sidebar access
    useEffect(() => {
        if (phase && flow.globalContext !== undefined) {
            setGlobalContext(phase, flow.globalContext);
        }
    }, [phase, flow.globalContext, setGlobalContext]);

    // Listen for sidebar edits to globalContext and update flow
    const storeContext = useVibeDevStore((state) => phase ? state.globalContextByPhase[phase] : undefined);
    useEffect(() => {
        if (phase && storeContext !== undefined && storeContext !== flow.globalContext) {
            setFlow(prev => ({ ...prev, globalContext: storeContext }));
        }
    }, [storeContext, phase]);

    // Persist to backend (debounced)
    useEffect(() => {
        if (!currentJobId || !phase) return;

        if (saveTimerRef.current) {
            window.clearTimeout(saveTimerRef.current);
        }

        saveTimerRef.current = window.setTimeout(() => {
            const currentGraphState: any = uiState?.flow_state || {};
            const unified = { ...(currentGraphState.unified_workflows || {}) };
            unified[phase] = flow;

            void saveUIState(currentJobId, {
                ...currentGraphState,
                unified_workflows: unified,
            }).catch((err) => console.error('Failed to save workflow state:', err));
        }, 500);

        return () => {
            if (saveTimerRef.current) {
                window.clearTimeout(saveTimerRef.current);
                saveTimerRef.current = null;
            }
        };
    }, [flow, currentJobId, phase, uiState?.flow_state]);

    // Save immediately on page unload (catches refresh/close)
    useEffect(() => {
        if (!currentJobId || !phase) return;

        const handleBeforeUnload = () => {
            // Cancel pending debounced save
            if (saveTimerRef.current) {
                window.clearTimeout(saveTimerRef.current);
                saveTimerRef.current = null;
            }

            // Save immediately (synchronous)
            const currentGraphState: any = uiState?.flow_state || {};
            const unified = { ...(currentGraphState.unified_workflows || {}) };
            unified[phase] = flow;

            // Use sendBeacon for reliable save during page unload
            const blob = new Blob(
                [JSON.stringify({ graph_state: { ...currentGraphState, unified_workflows: unified } })],
                { type: 'application/json' }
            );
            navigator.sendBeacon(`/api/jobs/${currentJobId}/ui-state`, blob);
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [currentJobId, phase, flow, uiState?.flow_state]);

    if (!currentJobId || !uiState) {
        return (
            <div className="flex h-full items-center justify-center text-muted-foreground/60">
                <div className="text-center animate-pulse">
                    <div className="text-5xl mb-6 opacity-30">🚀</div>
                    <p className="text-lg font-medium">Awaiting Mission Context</p>
                    <p className="text-sm opacity-50 mt-2">Create or select a job to initialize system.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col">
            {/* Phase Header - Glass Bar */}
            {phase && (
                <div className="px-6 py-4 border-b border-white/5 bg-background/20 backdrop-blur-sm z-20 flex-shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-xl shadow-[0_0_15px_-5px_rgba(var(--primary),0.3)]">
                                {PHASE_LABELS[phase].icon}
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                                    {PHASE_LABELS[phase].title}
                                    <span className="text-[10px] font-mono text-muted-foreground bg-white/5 px-2 py-0.5 rounded-full border border-white/5 uppercase tracking-wide">
                                        Phase {['research', 'planning', 'execution', 'review'].indexOf(phase) + 1}/4
                                    </span>
                                </h2>
                                <p className="text-xs text-muted-foreground mt-0.5">{PHASE_LABELS[phase].description}</p>
                            </div>
                        </div>

                        {!lockCompletedSteps && (
                            <div className="mt-2 flex items-center justify-end gap-2">
                                <button
                                    className="px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-cyan-500/20 transition-all hover:scale-105 active:scale-95"
                                    onClick={() => {
                                        if (!currentJobId) return;
                                        void compileUnifiedWorkflow(currentJobId).catch((err) => {
                                            console.error('Failed to compile workflow:', err);
                                            alert('Failed to compile workflow. Check console for details.');
                                        });
                                    }}
                                    disabled={!currentJobId}
                                    title="Process steps into executable task chain"
                                >
                                    Compile Chain
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="flex-1 flex min-h-0 relative">
                <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none" />
                {/* Main Editor - now takes full width */}
                <div className="flex-1 overflow-hidden z-10">
                    <HorizontalStepFlow
                        flow={flow}
                        onChange={setFlow}
                        currentPhase={phase}
                        stepStatusById={stepStatusById}
                        lockCompletedSteps={lockCompletedSteps}
                    />
                </div>
            </div>
        </div>
    );
}

export default UnifiedWorkflowView;
