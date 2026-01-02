import { cn } from '@/lib/utils';
import {
  BeakerIcon,
  DocumentMagnifyingGlassIcon,
  RectangleStackIcon,
} from '@heroicons/react/24/outline';
import type { DragEvent } from 'react';

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
    id: 'context-fetcher',
    title: 'Context Fetcher',
    description: 'Gather repo context before making changes.',
    icon: 'context',
    payload: {
      type: 'node',
      data: {
        title: 'Repo recon',
        instruction:
          'Inspect relevant files, identify entrypoints, and summarize constraints before implementing changes.',
        acceptance_criteria: 'Entrypoints identified\nRisks listed',
        required_evidence: 'notes\ncommands_run',
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
  const onDragStart = (
    event: DragEvent,
    payload: WorkflowTemplatePayload,
    label: string
  ) => {
    event.dataTransfer.setData(
      'application/vibedev-template',
      JSON.stringify(payload)
    );
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', label);
  };

  return (
    <aside className="w-72 shrink-0 border-r border-white/5 bg-black/20 backdrop-blur-md">
      <div className="p-4">
        <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Template Library
        </div>
        <div className="mt-2 text-[11px] text-muted-foreground/70 leading-relaxed">
          Drag a template onto the canvas to instantiate a step (or an entire
          micro-workflow).
        </div>
      </div>

      <div className="px-3 pb-4 space-y-2 custom-scrollbar overflow-y-auto">
        {templates.map((t) => (
          <div
            key={t.id}
            draggable
            onDragStart={(e) => onDragStart(e, t.payload, t.title)}
            className={cn(
              'group rounded-xl border border-white/5 bg-white/5 hover:bg-white/10',
              'transition-all duration-300 cursor-grab active:cursor-grabbing',
              'p-3 shadow-[0_0_0_rgba(59,130,246,0)] hover:shadow-[0_0_15px_rgba(59,130,246,0.12)]',
              'active:scale-[0.99]'
            )}
            title="Drag to canvas"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-black/30 border border-white/5">
                {iconFor(t.icon)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold text-sm text-white/90 truncate">
                    {t.title}
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
                    {t.payload.type}
                  </span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground/80 leading-snug">
                  {t.description}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}

