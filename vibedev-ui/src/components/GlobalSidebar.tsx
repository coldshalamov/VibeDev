// =============================================================================
// Global Sidebar "Truth Surface"
// =============================================================================

import { useVibeDevStore } from '@/stores/useVibeDevStore';
import { cn, formatDate } from '@/lib/utils';
import { useMemo, useState } from 'react';
import {
  BookOpenIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  ServerStackIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline'; // Assuming you have heroicons or use SVGs
import { exportJob } from '@/lib/api';

export function GlobalSidebar() {
  const uiState = useVibeDevStore((state) => state.uiState);
  const sidebar = useVibeDevStore((state) => state.sidebar);
  const setSidebarSection = useVibeDevStore((state) => state.setSidebarSection);

  if (!uiState) {
    return (
      <div className="h-full border-r bg-card/30 backdrop-blur-xl p-6 flex items-center justify-center text-muted-foreground">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-white/5 mx-auto flex items-center justify-center">?</div>
          <p>No Active Job</p>
        </div>
      </div>
    );
  }

  const { job, mistakes, planning_answers } = uiState;
  const statusPill = useMemo(() => {
    const status = job.status;
    const base =
      'inline-flex items-center gap-2 px-2.5 py-1 rounded-full border text-[10px] font-bold tracking-widest font-mono';

    if (status === 'EXECUTING') {
      return {
        label: 'EXECUTING',
        className:
          base +
          ' bg-primary/15 border-primary/30 text-primary shadow-[0_0_14px_rgba(59,130,246,0.28)]',
        dot: 'bg-primary shadow-[0_0_10px_rgba(59,130,246,0.6)] animate-pulse',
      };
    }
    if (status === 'PLANNING') {
      return {
        label: 'PLANNING',
        className:
          base +
          ' bg-yellow-500/15 border-yellow-500/30 text-yellow-300 shadow-[0_0_12px_rgba(234,179,8,0.18)]',
        dot: 'bg-yellow-400 shadow-[0_0_10px_rgba(234,179,8,0.5)]',
      };
    }
    if (status === 'READY') {
      return {
        label: 'READY',
        className:
          base +
          ' bg-emerald-500/15 border-emerald-500/30 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.18)]',
        dot: 'bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.5)]',
      };
    }
    if (status === 'PAUSED') {
      return {
        label: 'PAUSED',
        className:
          base +
          ' bg-yellow-500/15 border-yellow-500/30 text-yellow-300 shadow-[0_0_12px_rgba(234,179,8,0.18)]',
        dot: 'bg-yellow-400 shadow-[0_0_10px_rgba(234,179,8,0.5)]',
      };
    }
    if (status === 'FAILED') {
      return {
        label: 'FAILED',
        className:
          base +
          ' bg-red-500/15 border-red-500/30 text-red-300 shadow-[0_0_12px_rgba(239,68,68,0.18)]',
        dot: 'bg-red-400 shadow-[0_0_10px_rgba(239,68,68,0.5)]',
      };
    }
    if (status === 'COMPLETE') {
      return {
        label: 'COMPLETE',
        className:
          base +
          ' bg-emerald-500/15 border-emerald-500/30 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.18)]',
        dot: 'bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.5)]',
      };
    }

    return {
      label: status,
      className: base + ' bg-white/5 border-white/10 text-white/70',
      dot: 'bg-white/50',
    };
  }, [job.status]);

  const handleExport = async () => {
    try {
      const res = await exportJob(job.job_id, 'md');
      if (!res.content) throw new Error('Missing export content');
      const blob = new Blob([res.content], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `job-report-${job.job_id}.md`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
      alert('Failed to export job report.');
    }
  };

  return (
    <div className="h-full border-r border-white/5 bg-card/60 backdrop-blur-2xl flex flex-col text-sm font-sans">
      {/* HUD Header */}
      <div className="p-4 border-b border-white/5 bg-black/20">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* Removed the standalone dot here, it's now inside the status pill */}
            <div className="min-w-0">
              <h2 className="font-bold tracking-tight text-white/90 truncate">{job.title}</h2>
              <p className="text-xs text-muted-foreground truncate font-mono mt-0.5">{job.job_id.slice(0, 8)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={statusPill.className}>
              <span className={cn("w-1.5 h-1.5 rounded-full", statusPill.dot)} />
              {statusPill.label}
            </span>
            <button
              onClick={handleExport}
              className="p-1.5 rounded-md border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all text-muted-foreground hover:text-white"
              title="Export Job Report"
            >
              <ArrowDownTrayIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex p-1 gap-1 m-2 bg-black/20 rounded-lg border border-white/5">
        <SidebarTab
          active={sidebar.activeSection === 'metadata'}
          onClick={() => setSidebarSection('metadata')}
          icon={<BookOpenIcon className="w-4 h-4" />}
          label="Info"
        />
        <SidebarTab
          active={sidebar.activeSection === 'invariants'}
          onClick={() => setSidebarSection('invariants')}
          icon={<ShieldCheckIcon className="w-4 h-4" />}
          label="Rules"
          count={job.invariants?.length}
        />
        <SidebarTab
          active={sidebar.activeSection === 'mistakes'}
          onClick={() => setSidebarSection('mistakes')}
          icon={<ExclamationTriangleIcon className="w-4 h-4" />}
          label="Errors"
          count={mistakes.length}
          alert={mistakes.length > 0}
        />
        <SidebarTab
          active={sidebar.activeSection === 'context'}
          onClick={() => setSidebarSection('context')}
          icon={<ServerStackIcon className="w-4 h-4" />}
          label="Ctx"
        />
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-2 custom-scrollbar">
        {sidebar.activeSection === 'metadata' && (
          <MetadataSection job={job} planningAnswers={planning_answers} />
        )}
        {sidebar.activeSection === 'invariants' && (
          <InvariantsSection invariants={job.invariants || []} />
        )}
        {sidebar.activeSection === 'mistakes' && (
          <MistakesSection mistakes={mistakes} />
        )}
        {sidebar.activeSection === 'context' && (
          <ContextSection uiState={uiState} />
        )}
      </div>

      {/* Footer / Status */}
      <div className="p-3 border-t border-white/5 bg-black/10 text-xs text-muted-foreground font-mono flex justify-between">
        <span>VibeDev v0.1</span>
        <span>{formatDate(new Date().toISOString())}</span>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Sub-components
// -----------------------------------------------------------------------------

function SidebarTab({ active, onClick, icon, label, count, alert }: any) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 flex flex-col items-center justify-center py-2 rounded-md transition-all duration-200 relative group",
        active ? "bg-primary/20 text-primary shadow-sm ring-1 ring-primary/50" : "hover:bg-white/5 text-muted-foreground hover:text-white"
      )}
    >
      {icon}
      <span className="text-[10px] mt-1 font-medium">{label}</span>
      {count !== undefined && count > 0 && (
        <span className={cn(
          "absolute top-0.5 right-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold border border-black/50 shadow-sm",
          alert ? "bg-red-500 text-white" : "bg-muted text-white"
        )}>
          {count}
        </span>
      )}
    </button>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-3 pl-1 border-l-2 border-primary/50">
      {title}
    </h3>
  )
}

function MetadataSection({ job, planningAnswers }: any) {
  return (
    <div className="space-y-6 p-2 animate-fade-in">
      <div>
        <SectionHeader title="Objective" />
        <div className="p-3 bg-white/5 rounded-lg border border-white/5 text-sm leading-relaxed text-white/80">
          {job.goal}
        </div>
      </div>

      {(planningAnswers?.target_environment || planningAnswers?.timeline_priority) && (
        <div>
          <SectionHeader title="Context" />
          <div className="grid grid-cols-2 gap-2">
            {planningAnswers?.target_environment && (
              <div className="p-3 bg-white/5 rounded-lg border border-white/5">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                  Environment
                </div>
                <div className="mt-1 text-sm text-white/80 truncate">
                  {String(planningAnswers.target_environment)}
                </div>
              </div>
            )}
            {planningAnswers?.timeline_priority && (
              <div className="p-3 bg-white/5 rounded-lg border border-white/5">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                  Priority
                </div>
                <div className="mt-1 text-sm text-white/80 truncate">
                  {String(planningAnswers.timeline_priority)}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div>
        <SectionHeader title="Deliverables" />
        <ul className="space-y-2">
          {job.deliverables?.map((d: string, i: number) => (
            <li key={i} className="flex gap-3 text-sm group">
              <div className="w-1.5 h-1.5 rounded-full bg-primary/50 mt-1.5 group-hover:bg-primary transition-colors" />
              <span className="text-muted-foreground group-hover:text-white transition-colors">{d}</span>
            </li>
          ))}
        </ul>
      </div>

      {job.definition_of_done?.length > 0 && (
        <div>
          <SectionHeader title="Definition of Done" />
          <div className="space-y-1">
            {job.definition_of_done.map((d: string, i: number) => (
              <div key={i} className="flex items-center gap-2 p-2 rounded hover:bg-white/5 transition-colors cursor-default">
                <div className="w-4 h-4 rounded border border-white/20 flex items-center justify-center">
                  <div className="w-2 h-2 bg-transparent" />
                </div>
                <span className="text-sm text-muted-foreground">{d}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function InvariantsSection({ invariants }: { invariants: string[] }) {
  if (invariants.length === 0) return <EmptyPlaceholder text="No active rules" />;

  return (
    <div className="space-y-2 p-2 animate-fade-in">
      <div className="text-xs text-muted-foreground mb-4 px-1">
        These rules are injected into every prompt to guarantee compliance.
      </div>
      {invariants.map((inv, i) => (
        <div key={i} className="flex gap-3 p-3 bg-red-500/5 border border-red-500/20 rounded-lg hover:border-red-500/40 transition-colors">
          <ShieldCheckIcon className="w-5 h-5 text-red-400 shrink-0" />
          <span className="text-sm text-red-100/80">{inv}</span>
        </div>
      ))}
    </div>
  );
}

function MistakesSection({ mistakes }: { mistakes: any[] }) {
  if (mistakes.length === 0) return <EmptyPlaceholder text="No recorded mistakes" />;

  return (
    <div className="space-y-3 p-2 animate-fade-in">
      {mistakes.map((m) => (
        <div key={m.mistake_id} className="p-3 bg-orange-500/5 border border-orange-500/20 rounded-lg hover:bg-orange-500/10 transition-colors cursor-pointer group">
          <div className="flex items-center gap-2 mb-2">
            <ExclamationTriangleIcon className="w-4 h-4 text-orange-400" />
            <span className="font-semibold text-orange-200 text-sm group-hover:underline">{m.title}</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{m.lesson}</p>
        </div>
      ))}
    </div>
  )
}

function ContextSection({ uiState }: { uiState: any }) {
  const { repo_map } = uiState;
  const [filter, setFilter] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const normalizedPaths = useMemo<string[]>(() => {
    const raw = (repo_map || []).map((e: any) => String(e.path || '')).filter(Boolean);
    return raw.map((p: string) => p.split('\\').join('/'));
  }, [repo_map]);

  type TreeNode = {
    type: 'dir' | 'file';
    name: string;
    path: string;
    children?: TreeNode[];
  };

  const tree = useMemo<TreeNode>(() => {
    const root: TreeNode = { type: 'dir', name: '', path: '', children: [] };

    const ensureChildDir = (parent: TreeNode, name: string, path: string) => {
      const existing = parent.children?.find((c) => c.type === 'dir' && c.name === name);
      if (existing) return existing;
      const created: TreeNode = { type: 'dir', name, path, children: [] };
      parent.children?.push(created);
      return created;
    };

    for (const fullPath of normalizedPaths) {
      const parts = fullPath.split('/').filter(Boolean);
      if (parts.length === 0) continue;

      let cursor = root;
      for (let i = 0; i < parts.length; i += 1) {
        const name = parts[i];
        const cursorPath = parts.slice(0, i + 1).join('/');

        const isLeaf = i === parts.length - 1;
        if (isLeaf) {
          cursor.children?.push({ type: 'file', name, path: cursorPath });
        } else {
          cursor = ensureChildDir(cursor, name, cursorPath);
        }
      }
    }

    const sortTree = (node: TreeNode) => {
      if (!node.children) return;
      node.children.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      node.children.forEach(sortTree);
    };
    sortTree(root);

    return root;
  }, [normalizedPaths]);

  const filtered = useMemo<string[]>(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return [];
    return normalizedPaths.filter((p) => p.toLowerCase().includes(q)).slice(0, 120);
  }, [filter, normalizedPaths]);

  const toggle = (path: string, current: boolean) => {
    setCollapsed((prev) => ({ ...prev, [path]: !current }));
  };

  const renderNode = (node: TreeNode, depth: number) => {
    if (node.type === 'file') {
      return (
        <button
          key={node.path}
          type="button"
          onClick={() => navigator.clipboard.writeText(node.path)}
          className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/5 group transition-colors"
          title="Click to copy path"
        >
          <span
            className="text-xs font-mono text-muted-foreground group-hover:text-primary transition-colors truncate"
            style={{ paddingLeft: depth * 10 }}
          >
            {node.name}
          </span>
        </button>
      );
    }

    const has = Object.prototype.hasOwnProperty.call(collapsed, node.path);
    const isCollapsed = has ? collapsed[node.path] : depth >= 2;
    return (
      <div key={node.path || '__root'} className="space-y-0.5">
        {node.path && (
          <button
            type="button"
            onClick={() => toggle(node.path, isCollapsed)}
            className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/5 transition-colors group"
          >
            <span
              className="text-[10px] uppercase tracking-wider text-white/70 group-hover:text-white/90"
              style={{ paddingLeft: depth * 10 }}
            >
              {isCollapsed ? '▸' : '▾'} {node.name}
            </span>
            <span className="text-[10px] text-muted-foreground/70 ml-auto">
              {node.children?.length ?? 0}
            </span>
          </button>
        )}

        {!isCollapsed &&
          node.children?.map((c) => renderNode(c, node.path ? depth + 1 : depth))}
      </div>
    );
  };

  return (
    <div className="p-2 animate-fade-in space-y-6">
      <div>
        <SectionHeader title="Active Repo Map" />

        <div className="mb-3 px-1">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter paths..."
            className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white/80 placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all"
          />
          <div className="mt-2 text-[10px] text-muted-foreground/70">
            Click an entry to copy its path.
          </div>
        </div>

        <div className="space-y-1">
          {filter.trim() ? (
            filtered.length === 0 ? (
              <div className="text-xs text-muted-foreground/60 font-mono bg-black/20 border border-white/5 rounded-lg p-3">
                No matches.
              </div>
            ) : (
              filtered.map((p: string) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => navigator.clipboard.writeText(p)}
                  className="w-full text-left px-2 py-1.5 rounded hover:bg-white/5 group transition-colors"
                  title="Click to copy path"
                >
                  <span className="text-xs font-mono text-muted-foreground group-hover:text-primary transition-colors truncate">
                    {p}
                  </span>
                </button>
              ))
            )
          ) : normalizedPaths.length === 0 ? (
            <div className="text-xs text-muted-foreground/60 font-mono bg-black/20 border border-white/5 rounded-lg p-3">
              Repo map is empty.
            </div>
          ) : (
            renderNode(tree, 0)
          )}
        </div>
      </div>
    </div>
  )
}

function EmptyPlaceholder({ text }: { text: string }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-muted-foreground/50 p-8 text-center border-2 border-dashed border-white/5 rounded-xl m-2">
      <div className="text-2xl mb-2">∅</div>
      <div className="text-sm font-medium">{text}</div>
    </div>
  )
}
