import { useEffect, useMemo, useState } from 'react';
import {
  MagnifyingGlassIcon,
  PlusIcon,
  TrashIcon,
  ClipboardDocumentIcon,
  AdjustmentsHorizontalIcon,
} from '@heroicons/react/24/outline';

import { useVibeDevStore } from '@/stores/useVibeDevStore';
import {
  useAddContextBlock,
  useContextBlock,
  useContextSearch,
  useDeleteContextBlock,
  useUpdateContextBlock,
  useUpdateJobPolicies,
} from '@/hooks/useUIState';
import { cn, formatDate } from '@/lib/utils';

type BlockTemplate = {
  id: string;
  label: string;
  blockType: string;
  tags: string[];
  content: string;
};

function templateContent(title: string, sections: Array<{ h: string; body: string }>) {
  const lines: string[] = [`# ${title}`, ''];
  for (const s of sections) {
    lines.push(`## ${s.h}`);
    lines.push(s.body);
    lines.push('');
  }
  return lines.join('\n').trim() + '\n';
}

const TEMPLATES: BlockTemplate[] = [
  {
    id: 'research-prompt',
    label: 'Research Prompt',
    blockType: 'PROMPT',
    tags: ['phase:research', 'kind:prompt'],
    content: templateContent('Research Prompt', [
      { h: 'Role', body: 'You are a senior engineer doing repo reconnaissance.' },
      { h: 'Context', body: '(What do we already know? Paste docs/paths here.)' },
      { h: 'Task', body: '(What should the model investigate next?)' },
      { h: 'Guardrails', body: '- Be specific\n- Cite files/paths\n- Avoid assumptions' },
      { h: 'Deliverables', body: '- Findings\n- Risks\n- Recommended next prompts' },
    ]),
  },
  {
    id: 'finding',
    label: 'Finding / Note',
    blockType: 'NOTE',
    tags: ['phase:research', 'kind:finding'],
    content: templateContent('Finding', [
      { h: 'What I Found', body: '' },
      { h: 'Evidence', body: '- `path/to/file`\n- command output\n- links' },
      { h: 'Implications', body: '' },
    ]),
  },
  {
    id: 'decision',
    label: 'Decision',
    blockType: 'DECISION',
    tags: ['phase:planning', 'kind:decision'],
    content: templateContent('Decision', [
      { h: 'Decision', body: '' },
      { h: 'Why', body: '' },
      { h: 'Consequences', body: '' },
    ]),
  },
  {
    id: 'breakpoint',
    label: 'Breakpoint / New Thread',
    blockType: 'BREAKPOINT',
    tags: ['kind:breakpoint'],
    content: templateContent('Breakpoint', [
      { h: 'Trigger', body: 'Start a new thread when:' },
      { h: 'Reason', body: '' },
      { h: 'What to carry forward', body: '- Invariants\n- Latest prompt pack\n- Current failures' },
    ]),
  },
  {
    id: 'gate-soft',
    label: 'Soft Gate (LLM Judgement)',
    blockType: 'GATE_SOFT',
    tags: ['kind:gate', 'mode:soft'],
    content: templateContent('Soft Gate', [
      { h: 'Criterion', body: '(Describe what “good enough” means.)' },
      { h: 'How to judge', body: '(What should the model check?)' },
    ]),
  },
  {
    id: 'gate-hard',
    label: 'Hard Gate (Script)',
    blockType: 'GATE_HARD',
    tags: ['kind:gate', 'mode:hard'],
    content: templateContent('Hard Gate', [
      { h: 'Command', body: 'python -m pytest -q' },
      { h: 'Expected', body: 'Exit code 0' },
      { h: 'Notes', body: '(Allowlist rules apply if shell gates are enabled.)' },
    ]),
  },
];

function tagsToString(tags: string[]) {
  return tags.join(', ');
}

function parseTags(raw: string): string[] {
  return raw
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

export function ResearchDashboard() {
  const currentJobId = useVibeDevStore((state) => state.currentJobId);
  const uiState = useVibeDevStore((state) => state.uiState);

  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftType, setDraftType] = useState('NOTE');
  const [draftTags, setDraftTags] = useState('');
  const [draftContent, setDraftContent] = useState('');
  const [checkpointInterval, setCheckpointInterval] = useState<number | ''>('');

  const { data: searchData, isLoading: isSearching } = useContextSearch(
    currentJobId,
    search
  );
  const { data: selectedBlock } = useContextBlock(currentJobId, selectedId);

  const addMutation = currentJobId ? useAddContextBlock(currentJobId) : null;
  const updateMutation = currentJobId ? useUpdateContextBlock(currentJobId) : null;
  const deleteMutation = currentJobId ? useDeleteContextBlock(currentJobId) : null;
  const updatePoliciesMutation = currentJobId ? useUpdateJobPolicies(currentJobId) : null;

  useEffect(() => {
    if (!uiState) return;
    const value = (uiState.job.policies as any)?.checkpoint_interval_steps;
    setCheckpointInterval(typeof value === 'number' ? value : 5);
  }, [uiState?.job.policies]);

  useEffect(() => {
    if (!selectedBlock) return;
    setDraftType(selectedBlock.block_type);
    setDraftTags(tagsToString(selectedBlock.tags || []));
    setDraftContent(selectedBlock.content || '');
  }, [selectedBlock?.context_id]);

  const results = (searchData?.results || []) as Array<{
    context_id: string;
    block_type: string;
    tags: string[];
    created_at: string;
    excerpt: string;
  }>;

  const groupedTemplates = useMemo(() => {
    return [
      { title: 'Prompts', items: TEMPLATES.filter((t) => t.tags.includes('kind:prompt')) },
      { title: 'Notes', items: TEMPLATES.filter((t) => t.blockType === 'NOTE') },
      { title: 'Workflow', items: TEMPLATES.filter((t) => t.tags.includes('kind:breakpoint')) },
      { title: 'Gates', items: TEMPLATES.filter((t) => t.tags.includes('kind:gate')) },
      { title: 'Decisions', items: TEMPLATES.filter((t) => t.blockType === 'DECISION') },
    ].filter((g) => g.items.length > 0);
  }, []);

  if (!currentJobId || !uiState) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground/60">
        No active job
      </div>
    );
  }

  const createFromTemplate = async (tpl: BlockTemplate) => {
    if (!addMutation) return;
    try {
      const res = await addMutation.mutateAsync({
        blockType: tpl.blockType,
        content: tpl.content,
        tags: tpl.tags,
      });
      setSelectedId(res.context_id);
      // Show success feedback
      const successMsg = document.createElement('div');
      successMsg.className = 'fixed top-4 right-4 bg-primary/20 border border-primary/40 text-primary px-4 py-2 rounded-lg shadow-lg z-50 animate-in fade-in slide-in-from-top-2 duration-300';
      successMsg.textContent = `✓ Created ${tpl.label}`;
      document.body.appendChild(successMsg);
      setTimeout(() => {
        successMsg.classList.add('animate-out', 'fade-out', 'slide-out-to-top-2');
        setTimeout(() => document.body.removeChild(successMsg), 300);
      }, 2000);
    } catch (err) {
      console.error('Failed to create block:', err);
      alert(`Failed to create ${tpl.label}. Check console for details.`);
    }
  };

  const saveSelected = async () => {
    if (!updateMutation || !selectedId) return;
    try {
      await updateMutation.mutateAsync({
        contextId: selectedId,
        patch: {
          block_type: draftType,
          content: draftContent,
          tags: parseTags(draftTags),
        },
      });
      // Show success feedback
      const successMsg = document.createElement('div');
      successMsg.className = 'fixed top-4 right-4 bg-green-500/20 border border-green-500/40 text-green-300 px-4 py-2 rounded-lg shadow-lg z-50 animate-in fade-in slide-in-from-top-2 duration-300';
      successMsg.textContent = '✓ Block saved';
      document.body.appendChild(successMsg);
      setTimeout(() => {
        successMsg.classList.add('animate-out', 'fade-out', 'slide-out-to-top-2');
        setTimeout(() => document.body.removeChild(successMsg), 300);
      }, 2000);
    } catch (err) {
      console.error('Failed to save block:', err);
      alert('Failed to save block. Check console for details.');
    }
  };

  const deleteSelected = async () => {
    if (!deleteMutation || !selectedId) return;
    const ok = window.confirm('Delete this block? This cannot be undone.');
    if (!ok) return;
    try {
      await deleteMutation.mutateAsync(selectedId);
      setSelectedId(null);
    } catch (err) {
      console.error('Failed to delete block:', err);
      alert('Failed to delete block. Check console for details.');
    }
  };

  const saveCheckpointPolicy = async () => {
    if (!updatePoliciesMutation) return;
    const next =
      checkpointInterval === '' ? 0 : Math.max(0, Math.min(999, checkpointInterval));
    setCheckpointInterval(next);
    await updatePoliciesMutation.mutateAsync({
      update: { checkpoint_interval_steps: next },
      merge: true,
    });
  };

  const selectedSummary = results.find((r) => r.context_id === selectedId) || null;

  return (
    <div className="h-full p-6 flex flex-col gap-6">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-2xl font-bold">Research & Context</h1>
          <p className="text-muted-foreground">
            Create prompts, capture findings, and shape the workflow toolbox the agent will use.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60">
              <MagnifyingGlassIcon className="w-4 h-4" />
            </div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search blocks..."
              className="w-64 bg-black/20 border border-white/10 rounded-lg pl-10 pr-3 py-2 text-xs font-mono text-white/80 placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6 flex-1 min-h-0">
        {/* Left: Block Library + Knowledge Base */}
        <div className="col-span-4 flex flex-col min-h-0 gap-6">
          <div className="panel">
            <div className="panel-header">
              <h3 className="panel-title flex items-center gap-2">
                <PlusIcon className="w-4 h-4 text-primary" /> Toolbox
              </h3>
              <div className="text-[10px] text-muted-foreground font-mono">
                templates
              </div>
            </div>
            <div className="px-3 pt-2 pb-3">
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-2 text-[10px] text-primary/90 leading-relaxed">
                <strong>💡 How to use:</strong> Click a template below to create a new block. It will appear in the Knowledge Base, where you can select and edit it.
              </div>
            </div>
            <div className="p-3 space-y-4 max-h-56 overflow-y-auto custom-scrollbar">
              {groupedTemplates.map((group) => (
                <div key={group.title} className="space-y-2">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold px-1">
                    {group.title}
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {group.items.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => createFromTemplate(t)}
                        disabled={addMutation?.isPending}
                        className={cn(
                          'text-left rounded-xl border border-white/5 bg-white/5 hover:bg-white/10',
                          'transition-all duration-300 p-3 shadow-[0_0_0_rgba(59,130,246,0)] hover:shadow-[0_0_15px_rgba(59,130,246,0.12)]',
                          'active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed'
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-semibold text-sm text-white/90 truncate">
                            {addMutation?.isPending ? '⏳ Creating...' : t.label}
                          </div>
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-mono">
                            {t.blockType}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground/70 font-mono truncate">
                          {t.tags.join(' • ')}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel flex-1 min-h-0">
            <div className="panel-header">
              <h3 className="panel-title">Knowledge Base</h3>
              <div className="text-xs text-muted-foreground font-mono">
                {isSearching ? 'loading…' : `${results.length} blocks`}
              </div>
            </div>
            <div className="p-2 overflow-y-auto custom-scrollbar space-y-2">
              {results.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground/70 text-sm">
                  No blocks yet. Create one from the Toolbox.
                </div>
              ) : (
                results.map((r) => {
                  const isActive = r.context_id === selectedId;
                  return (
                    <button
                      key={r.context_id}
                      onClick={() => setSelectedId(r.context_id)}
                      className={cn(
                        'w-full text-left rounded-xl border p-3 transition-all duration-200',
                        isActive
                          ? 'bg-primary/10 border-primary/30 shadow-[0_0_15px_rgba(59,130,246,0.12)]'
                          : 'bg-white/5 border-white/5 hover:bg-white/10'
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                            {r.block_type}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground/80 font-mono truncate">
                            {r.context_id} • {formatDate(r.created_at)}
                          </div>
                        </div>
                        <div className="text-[10px] text-muted-foreground/60 font-mono truncate max-w-[120px]">
                          {r.tags?.slice(0, 3).join(' ')}
                        </div>
                      </div>
                      <div className="mt-2 text-sm text-white/80 leading-snug line-clamp-3">
                        {r.excerpt}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Center: Editor */}
        <div className="col-span-5 panel flex flex-col min-h-0">
          <div className="panel-header">
            <h3 className="panel-title flex items-center gap-2">
              <ClipboardDocumentIcon className="w-4 h-4 text-primary" /> Block Editor
            </h3>
            <div className="flex items-center gap-2">
              {selectedId && (
                <button
                  onClick={() => navigator.clipboard.writeText(selectedId)}
                  className="btn btn-outline text-xs py-1"
                  title="Copy context_id"
                >
                  Copy ID
                </button>
              )}
              {selectedId && (
                <button
                  onClick={deleteSelected}
                  disabled={deleteMutation?.isPending}
                  className="btn text-xs py-1 bg-red-600/20 hover:bg-red-600/30 border border-red-500/20 text-red-200"
                  title="Delete block"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {!selectedId ? (
            <div className="p-8 text-center text-muted-foreground/70">
              Select a block from the Knowledge Base, or create one from the Toolbox.
            </div>
          ) : (
            <div className="p-4 space-y-4 overflow-y-auto custom-scrollbar min-h-0">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                    Block Type
                  </label>
                  <input
                    value={draftType}
                    onChange={(e) => setDraftType(e.target.value)}
                    className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white/80 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                    Tags
                  </label>
                  <input
                    value={draftTags}
                    onChange={(e) => setDraftTags(e.target.value)}
                    placeholder="phase:research, kind:prompt"
                    className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white/80 placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                  Content
                </label>
                <textarea
                  value={draftContent}
                  onChange={(e) => setDraftContent(e.target.value)}
                  className="w-full min-h-[420px] bg-black/30 border border-white/10 rounded-xl p-3 text-xs font-mono text-white/80 placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all"
                  placeholder="Write freeform notes, prompts, and workflow logic here..."
                />
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-muted-foreground font-mono truncate">
                  {selectedSummary ? `${selectedSummary.block_type} • ${selectedSummary.context_id}` : selectedId}
                </div>
                <button
                  onClick={saveSelected}
                  disabled={updateMutation?.isPending}
                  className="btn btn-primary"
                >
                  {updateMutation?.isPending ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: Repo Context + Execution Controls */}
        <div className="col-span-3 flex flex-col min-h-0 gap-6">
          <div className="panel">
            <div className="panel-header">
              <h3 className="panel-title flex items-center gap-2">
                <AdjustmentsHorizontalIcon className="w-4 h-4 text-primary" /> Breakpoints
              </h3>
            </div>
            <div className="p-4 space-y-3">
              <div className="text-xs text-muted-foreground">
                Optional autoprompt checkpoint. When enabled, the runner/extension can request a new thread every N steps.
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={999}
                  value={checkpointInterval}
                  onChange={(e) =>
                    setCheckpointInterval(e.target.value === '' ? '' : Number(e.target.value))
                  }
                  className="w-24 bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white/80 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all"
                />
                <button
                  onClick={saveCheckpointPolicy}
                  disabled={updatePoliciesMutation?.isPending}
                  className="btn btn-outline text-xs"
                >
                  {updatePoliciesMutation?.isPending ? 'Saving…' : 'Apply'}
                </button>
              </div>
              <div className="text-[10px] text-muted-foreground font-mono">
                `checkpoint_interval_steps` (0 disables)
              </div>
            </div>
          </div>

          <div className="panel flex-1 min-h-0">
            <div className="panel-header">
              <h3 className="panel-title">Repo Context</h3>
              <div className="text-xs text-muted-foreground font-mono">
                {uiState.repo_map?.length || 0}
              </div>
            </div>
            <div className="p-2 overflow-y-auto custom-scrollbar space-y-1">
              {(uiState.repo_map || []).slice(0, 40).map((e: any) => (
                <button
                  key={e.path}
                  type="button"
                  onClick={() => navigator.clipboard.writeText(e.path)}
                  className="w-full text-left px-2 py-1.5 rounded hover:bg-white/5 group transition-colors"
                  title="Click to copy path"
                >
                  <span className="text-xs font-mono text-muted-foreground group-hover:text-primary transition-colors truncate">
                    {e.path}
                  </span>
                </button>
              ))}
              {(uiState.repo_map || []).length > 40 && (
                <div className="px-2 py-2 text-xs text-muted-foreground italic">
                  + {(uiState.repo_map || []).length - 40} more…
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

