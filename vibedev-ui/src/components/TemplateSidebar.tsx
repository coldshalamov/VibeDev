import { cn } from '@/lib/utils';
import {
  BeakerIcon,
  DocumentMagnifyingGlassIcon,
  RectangleStackIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';
import { type DragEvent, useState } from 'react';

export type WorkflowTemplatePayload =
  | {
    type: 'node';
    data: {
      title?: string;
      instruction?: string;
      acceptance_criteria?: string;
      required_evidence?: string;
    };
  }
  | {
    type: 'graph';
    nodes: Array<{
      id: string;
      data: {
        title?: string;
        instruction?: string;
        acceptance_criteria?: string;
        required_evidence?: string;
      };
    }>;
    edges: Array<{ source: string; target: string }>;
  };

type WorkflowTemplate = {
  id: string;
  title: string;
  description: string;
  icon: 'stack' | 'beaker' | 'context';
  payload: WorkflowTemplatePayload;
};

const templates: WorkflowTemplate[] = [
  {
    id: 'tdd-loop',
    title: 'TDD Loop',
    description: 'Write test → implement → verify (tight iteration).',
    icon: 'beaker',
    payload: {
      type: 'graph',
      nodes: [
        {
          id: 't1',
          data: {
            title: 'Write the failing test',
            instruction:
              'Write a minimal failing test that captures the required behavior. Run it and confirm it fails for the expected reason.',
            acceptance_criteria: 'Test fails for expected reason',
            required_evidence: 'tests_run\ntests_passed=false',
          },
        },
        {
          id: 't2',
          data: {
            title: 'Implement minimal code',
            instruction:
              'Implement the minimal code needed to pass the test. Avoid unrelated refactors.',
            acceptance_criteria: 'Test now passes',
            required_evidence: 'changed_files\ndiff_summary\ntests_run\ntests_passed',
          },
        },
        {
          id: 't3',
          data: {
            title: 'Refactor (optional)',
            instruction:
              'Refactor for clarity without changing behavior. Re-run tests and keep everything green.',
            acceptance_criteria: 'All tests still pass',
            required_evidence: 'tests_run\ntests_passed',
          },
        },
      ],
      edges: [
        { source: 't1', target: 't2' },
        { source: 't2', target: 't3' },
      ],
    },
  },
  {
    id: 'react-component-gen',
    title: 'React Component Gen',
    description: 'Generate a component with verification gates.',
    icon: 'stack',
    payload: {
      type: 'node',
      data: {
        title: 'Generate component',
        instruction:
          'Create the requested React component. Keep it accessible, typed, and consistent with the design system.',
        acceptance_criteria: 'Component compiles\nMeets UX requirements',
        required_evidence: 'changed_files\ndiff_summary\ncommands_run',
      },
    },
  },
  {
    id: 'bug-fix-logic',
    title: 'Bug Fix Flow',
    description: 'Identify issue, propose fix, verify fix.',
    icon: 'stack',
    payload: {
      type: 'graph',
      nodes: [
        {
          id: 'b1',
          data: {
            title: 'Reproduce bug',
            instruction:
              'Identify the root cause of the bug and create a reproduction script or test case.',
            acceptance_criteria: 'Bug is reproduced consistently',
            required_evidence: 'commands_run\nreproduction_results',
          },
        },
        {
          id: 'b2',
          data: {
            title: 'Fix bug',
            instruction:
              'Apply the necessary code changes to fix the bug. Ensure no regressions.',
            acceptance_criteria: 'Bug is fixed\nTests pass',
            required_evidence: 'changed_files\ndiff_summary\ntests_run',
          },
        },
      ],
      edges: [{ source: 'b1', target: 'b2' }],
    },
  },
  {
    id: 'context-fetcher',
    title: 'Context Fetcher',
    description: 'Fetch relevant files/documentation for the task.',
    icon: 'context',
    payload: {
      type: 'node',
      data: {
        title: 'Fetch context',
        instruction:
          'Use search and read tools to gather all necessary context for the current objective.',
        acceptance_criteria: 'All relevant context obtained',
        required_evidence: 'commands_run\nresearch_summary',
      },
    },
  },
  {
    id: 'human-gate',
    title: 'Human Gate',
    description: 'Pause execution for manual human review.',
    icon: 'context',
    payload: {
      type: 'node',
      data: {
        title: 'Manual Review',
        instruction:
          'Review the current progress and provide feedback or approval to continue.',
        acceptance_criteria: 'human_approval',
        required_evidence: 'human_feedback',
      },
    },
  },
];

function iconFor(icon: WorkflowTemplate['icon']) {
  if (icon === 'beaker') return <BeakerIcon className="w-4 h-4 text-purple-400" />;
  if (icon === 'context')
    return <DocumentMagnifyingGlassIcon className="w-4 h-4 text-sky-400" />;
  return <RectangleStackIcon className="w-4 h-4 text-primary" />;
}

export function TemplateSidebar() {
  const [previewId, setPreviewId] = useState<string | null>(null);

  const onDragStart = (event: DragEvent, payload: WorkflowTemplatePayload) => {
    event.dataTransfer.setData('application/vibedev-template', JSON.stringify(payload));
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside className="w-72 shrink-0 border-r border-white/5 bg-black/20 backdrop-blur-md flex flex-col h-full">
      <div className="p-4">
        <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Template Library
        </div>
        <div className="mt-2 text-[11px] text-muted-foreground/70 leading-relaxed">
          Drag a template onto the canvas to instantiate a step (or an entire
          micro-workflow).
        </div>
      </div>

      <div className="flex-1 px-3 pb-4 space-y-3 custom-scrollbar overflow-y-auto">
        {templates.map((t) => (
          <div
            key={t.id}
            draggable
            onDragStart={(e) => onDragStart(e, t.payload)}
            className={cn(
              "group relative glass-panel p-3 border border-white/5 hover:border-primary/40 hover:bg-white/[0.05] transition-all cursor-grab active:cursor-grabbing rounded-xl"
            )}
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-black/30 border border-white/5 transition-colors group-hover:bg-primary/10">
                {iconFor(t.icon)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold text-xs text-white/90 truncate group-hover:text-primary transition-colors">
                    {t.title}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreviewId(previewId === t.id ? null : t.id);
                    }}
                    className="text-muted-foreground hover:text-white p-1 rounded-md hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-all"
                    title="Preview template"
                  >
                    <EyeIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="mt-1 text-[10px] text-muted-foreground/80 leading-snug line-clamp-2">
                  {t.description}
                </div>
              </div>
            </div>

            {previewId === t.id && (
              <div className="mt-3 p-2 rounded-lg bg-black/40 border border-white/10 text-[10px] space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                <div className="font-bold text-primary uppercase tracking-widest text-[9px]">Preview</div>
                {t.payload.type === 'graph' ? (
                  <div className="space-y-2">
                    {t.payload.nodes.map(n => (
                      <div key={n.id} className="pl-2 border-l border-primary/30">
                        <div className="font-bold text-gray-300">{n.data.title}</div>
                        <div className="text-muted-foreground italic line-clamp-1">{n.data.instruction}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="pl-2 border-l border-primary/30">
                    <div className="font-bold text-gray-300">{t.payload.data.title}</div>
                    <div className="text-muted-foreground italic line-clamp-2">{t.payload.data.instruction}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </aside>
  );
}
