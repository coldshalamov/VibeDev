// =============================================================================
// Info Sidebar - Research Findings, Mistakes, Dev Log, Global Context
// =============================================================================

import { useState, useRef } from 'react';
import { useClickOutside } from '@/hooks/useClickOutside';
import { cn } from '@/lib/utils';
import { useVibeDevStore } from '@/stores/useVibeDevStore';
import {
    BookOpenIcon,
    ExclamationTriangleIcon,
    ClockIcon,
    PlusIcon,
    TrashIcon,
    DocumentTextIcon,
} from '@heroicons/react/24/outline';

// =============================================================================
// Types
// =============================================================================

type ResearchFinding = {
    id: string;
    title: string;
    content: string;
    source: string; // Which step/prompt produced this
    createdAt: string;
};

type Mistake = {
    id: string;
    title: string;
    whatHappened: string;
    lesson: string;
    createdAt: string;
};

type LogEntry = {
    id: string;
    type: 'step' | 'error' | 'info';
    message: string;
    timestamp: string;
};

// =============================================================================
// Main Component
// =============================================================================

export function InfoSidebar() {
    const currentJobId = useVibeDevStore((state) => state.currentJobId);
    const uiState = useVibeDevStore((state) => state.uiState);
    const viewMode = useVibeDevStore((state) => state.viewMode.mode);
    const globalContextByPhase = useVibeDevStore((state) => state.globalContextByPhase);
    const setGlobalContext = useVibeDevStore((state) => state.setGlobalContext);

    // Get current phase's context
    const currentPhase = viewMode === 'workflow' ? 'research' : viewMode;
    const globalContext = globalContextByPhase[currentPhase] || '';
    const handleContextChange = (value: string) => setGlobalContext(currentPhase, value);

    const [activeTab, setActiveTab] = useState<'findings' | 'mistakes' | 'log' | 'context'>('findings');

    // For now, use localStorage. Later can connect to backend.
    const storageKey = `vibedev-info-${currentJobId}`;

    const [findings, setFindings] = useState<ResearchFinding[]>(() => {
        if (typeof window !== 'undefined' && currentJobId) {
            const saved = localStorage.getItem(`${storageKey}-findings`);
            if (saved) try { return JSON.parse(saved); } catch { /* ignore */ }
        }
        return [];
    });

    const [mistakes, setMistakes] = useState<Mistake[]>(() => {
        if (typeof window !== 'undefined' && currentJobId) {
            const saved = localStorage.getItem(`${storageKey}-mistakes`);
            if (saved) try { return JSON.parse(saved); } catch { /* ignore */ }
        }
        return [];
    });

    const [logs] = useState<LogEntry[]>([
        { id: '1', type: 'info', message: 'Job created', timestamp: new Date().toISOString() },
    ]);

    // Persist on change
    const saveFinding = (f: ResearchFinding) => {
        const updated = [...findings, f];
        setFindings(updated);
        localStorage.setItem(`${storageKey}-findings`, JSON.stringify(updated));
    };

    const deleteFinding = (id: string) => {
        const updated = findings.filter(f => f.id !== id);
        setFindings(updated);
        localStorage.setItem(`${storageKey}-findings`, JSON.stringify(updated));
    };

    const saveMistake = (m: Mistake) => {
        const updated = [...mistakes, m];
        setMistakes(updated);
        localStorage.setItem(`${storageKey}-mistakes`, JSON.stringify(updated));
    };

    const deleteMistake = (id: string) => {
        const updated = mistakes.filter(m => m.id !== id);
        setMistakes(updated);
        localStorage.setItem(`${storageKey}-mistakes`, JSON.stringify(updated));
    };

    if (!currentJobId) {
        return (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                Select a job
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-transparent">
            {/* Tabs */}
            <div className="flex p-2 gap-1 border-b border-white/5 bg-black/20 backdrop-blur-sm">
                <TabButton
                    active={activeTab === 'log'}
                    onClick={() => setActiveTab('log')}
                    icon={<ClockIcon className="w-4 h-4" />}
                    label="Log"
                    count={logs.length}
                />
                <TabButton
                    active={activeTab === 'findings'}
                    onClick={() => setActiveTab('findings')}
                    icon={<BookOpenIcon className="w-4 h-4" />}
                    label="Findings"
                    count={findings.length}
                />
                <TabButton
                    active={activeTab === 'context'}
                    onClick={() => setActiveTab('context')}
                    icon={<DocumentTextIcon className="w-4 h-4" />}
                    label="Context"
                />
                <TabButton
                    active={activeTab === 'mistakes'}
                    onClick={() => setActiveTab('mistakes')}
                    icon={<ExclamationTriangleIcon className="w-4 h-4" />}
                    label="Mistakes"
                    count={mistakes.length}
                />
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto custom-scrollbar p-3">
                {activeTab === 'context' && (
                    <GlobalContextPanel
                        value={globalContext}
                        onChange={handleContextChange}
                        repoRoot={uiState?.job?.repo_root ?? undefined}
                    />
                )}
                {activeTab === 'findings' && (
                    <FindingsPanel
                        findings={findings}
                        onAdd={saveFinding}
                        onDelete={deleteFinding}
                    />
                )}
                {activeTab === 'mistakes' && (
                    <MistakesPanel
                        mistakes={mistakes}
                        onAdd={saveMistake}
                        onDelete={deleteMistake}
                    />
                )}
                {activeTab === 'log' && (
                    <LogPanel logs={logs} />
                )}
            </div>
        </div>
    );
}

// =============================================================================
// Tab Button
// =============================================================================

function TabButton({
    active,
    onClick,
    icon,
    label,
    count,
}: {
    active: boolean;
    count?: number;
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
}) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] uppercase font-bold tracking-wider transition-all rounded-md",
                active
                    ? "bg-primary/20 text-primary shadow-[0_0_10px_-4px_rgba(var(--primary),0.5)] border border-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
            )}
        >
            {icon}
            <span className="hidden xl:inline">{label}</span>
            {count !== undefined && count > 0 && (
                <span className={cn(
                    "ml-0.5 px-1.5 py-0.5 rounded-full text-[9px]",
                    active ? "bg-primary/20 text-primary" : "bg-white/10 text-muted-foreground"
                )}>
                    {count}
                </span>
            )}
        </button>
    );
}

// =============================================================================
// Findings Panel
// =============================================================================

function FindingsPanel({
    findings,
    onAdd,
    onDelete,
}: {
    findings: ResearchFinding[];
    onAdd: (f: ResearchFinding) => void;
    onDelete: (id: string) => void;
}) {
    const [adding, setAdding] = useState(false);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    useClickOutside(containerRef, () => setAdding(false));

    const handleAdd = () => {
        if (!title.trim()) return;
        onAdd({
            id: `finding_${Date.now()}`,
            title: title.trim(),
            content: content.trim(),
            source: 'Manual',
            createdAt: new Date().toISOString(),
        });
        setTitle('');
        setContent('');
        setAdding(false);
    };

    return (
        <div className="space-y-4" ref={containerRef}>
            <div className="flex items-center justify-between px-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_5px_currentColor]"></span>
                    Knowledge Base
                </p>
                <button
                    onClick={() => setAdding(!adding)}
                    className="p-1 hover:bg-white/10 rounded text-primary transition-colors"
                >
                    <PlusIcon className="w-4 h-4" />
                </button>
            </div>

            {adding && (
                <div className="bg-black/40 border border-primary/30 rounded-lg p-3 space-y-3 animate-fade-in shadow-lg shadow-black/50">
                    <input
                        className="w-full bg-black/20 border border-white/10 rounded px-2 py-1.5 text-xs focus:border-primary/50 focus:outline-none transition-colors"
                        placeholder="Finding title..."
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        autoFocus
                    />
                    <textarea
                        className="w-full bg-black/20 border border-white/10 rounded px-2 py-1.5 text-xs h-24 resize-none focus:border-primary/50 focus:outline-none transition-colors"
                        placeholder="What was discovered..."
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                    />
                    <div className="flex gap-2 justify-end">
                        <button onClick={() => setAdding(false)} className="btn btn-ghost text-[10px] h-7 px-3">Cancel</button>
                        <button onClick={handleAdd} className="btn btn-primary text-[10px] h-7 px-3">Add Entry</button>
                    </div>
                </div>
            )}

            <div className="space-y-3">
                {findings.length === 0 && !adding ? (
                    <div className="text-center py-12 text-muted-foreground border border-dashed border-white/5 rounded-xl bg-white/[0.02]">
                        <BookOpenIcon className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="text-xs font-medium">No findings recorded</p>
                        <p className="text-[10px] opacity-60">Research data will aggregate here</p>
                    </div>
                ) : (
                    findings.map((f) => (
                        <div key={f.id} className="relative bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 rounded-lg p-3 group transition-all duration-300">
                            <div className="flex items-start justify-between gap-2 mb-1">
                                <div className="font-semibold text-xs text-foreground/90">{f.title}</div>
                                <button
                                    onClick={() => onDelete(f.id)}
                                    className="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-red-400 rounded transition-all"
                                >
                                    <TrashIcon className="w-3 h-3" />
                                </button>
                            </div>
                            {f.content && (
                                <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-4">{f.content}</p>
                            )}
                            <div className="text-[9px] text-muted-foreground/40 mt-2 font-mono uppercase tracking-wider flex items-center gap-1">
                                <span>Source:</span> <span className="text-primary/60">{f.source}</span>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

// =============================================================================
// Mistakes Panel
// =============================================================================

function MistakesPanel({
    mistakes,
    onAdd,
    onDelete,
}: {
    mistakes: Mistake[];
    onAdd: (m: Mistake) => void;
    onDelete: (id: string) => void;
}) {
    const [adding, setAdding] = useState(false);
    const [title, setTitle] = useState('');
    const [whatHappened, setWhatHappened] = useState('');
    const [lesson, setLesson] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    useClickOutside(containerRef, () => setAdding(false));

    const handleAdd = () => {
        if (!title.trim()) return;
        onAdd({
            id: `mistake_${Date.now()}`,
            title: title.trim(),
            whatHappened: whatHappened.trim(),
            lesson: lesson.trim(),
            createdAt: new Date().toISOString(),
        });
        setTitle('');
        setWhatHappened('');
        setLesson('');
        setAdding(false);
    };

    return (
        <div className="space-y-4" ref={containerRef}>
            <div className="flex items-center justify-between px-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_5px_currentColor]"></span>
                    Correction Log
                </p>
                <button
                    onClick={() => setAdding(!adding)}
                    className="p-1 hover:bg-white/10 rounded text-amber-500 transition-colors"
                >
                    <PlusIcon className="w-4 h-4" />
                </button>
            </div>

            {adding && (
                <div className="bg-black/40 border border-amber-500/30 rounded-lg p-3 space-y-3 animate-fade-in shadow-lg shadow-black/50">
                    <input
                        className="w-full bg-black/20 border border-white/10 rounded px-2 py-1.5 text-xs focus:border-amber-500/50 focus:outline-none transition-colors"
                        placeholder="Error title..."
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        autoFocus
                    />
                    <textarea
                        className="w-full bg-black/20 border border-white/10 rounded px-2 py-1.5 text-xs h-16 resize-none focus:border-amber-500/50 focus:outline-none transition-colors"
                        placeholder="What failed..."
                        value={whatHappened}
                        onChange={(e) => setWhatHappened(e.target.value)}
                    />
                    <textarea
                        className="w-full bg-black/20 border border-white/10 rounded px-2 py-1.5 text-xs h-12 resize-none focus:border-amber-500/50 focus:outline-none transition-colors"
                        placeholder="Protocol update / Lesson..."
                        value={lesson}
                        onChange={(e) => setLesson(e.target.value)}
                    />
                    <div className="flex gap-2 justify-end">
                        <button onClick={() => setAdding(false)} className="btn btn-ghost text-[10px] h-7 px-3">Cancel</button>
                        <button onClick={handleAdd} className="btn btn-primary bg-amber-600 hover:bg-amber-700 text-[10px] h-7 px-3">Log Error</button>
                    </div>
                </div>
            )}

            <div className="space-y-3">
                {mistakes.length === 0 && !adding ? (
                    <div className="text-center py-12 text-muted-foreground border border-dashed border-white/5 rounded-xl bg-white/[0.02]">
                        <ExclamationTriangleIcon className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="text-xs font-medium">Zero errors recorded</p>
                        <p className="text-[10px] opacity-60">System operating at nominal efficiency</p>
                    </div>
                ) : (
                    mistakes.map((m) => (
                        <div key={m.id} className="relative bg-amber-500/5 border border-amber-500/10 hover:border-amber-500/30 rounded-lg p-3 group transition-all duration-300">
                            <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="font-bold text-xs text-amber-500">{m.title}</div>
                                <button
                                    onClick={() => onDelete(m.id)}
                                    className="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-red-400 rounded transition-all"
                                >
                                    <TrashIcon className="w-3 h-3" />
                                </button>
                            </div>
                            {m.whatHappened && (
                                <p className="text-[11px] text-muted-foreground mb-2 leading-relaxed bg-black/20 p-1.5 rounded border border-white/5">{m.whatHappened}</p>
                            )}
                            {m.lesson && (
                                <div className="flex gap-2 items-start mt-2">
                                    <span className="text-emerald-500 mt-0.5">⚡</span>
                                    <p className="text-[11px] text-emerald-400/90 italic leading-relaxed">{m.lesson}</p>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

// =============================================================================
// Log Panel
// =============================================================================

function LogPanel({ logs }: { logs: LogEntry[] }) {
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between px-1 mb-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-foreground/50"></span>
                    System Events
                </p>
            </div>

            <div className="space-y-1 font-mono text-[10px]">
                {logs.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground border border-dashed border-white/5 rounded-xl bg-white/[0.02]">
                        <ClockIcon className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="text-xs font-medium">Log empty</p>
                    </div>
                ) : (
                    logs.map((log) => (
                        <div key={log.id} className="flex gap-3 p-2 rounded hover:bg-white/5 transition-colors border-l-2 border-transparent hover:border-primary/50">
                            <span className="text-muted-foreground/40 shrink-0 select-none">
                                {new Date(log.timestamp).toLocaleTimeString([], { hour12: false })}
                            </span>
                            <span className={cn(
                                "break-all",
                                log.type === 'error' && 'text-red-400 font-bold',
                                log.type === 'step' && 'text-primary',
                                log.type === 'info' && 'text-muted-foreground'
                            )}>
                                {log.message}
                            </span>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

// =============================================================================
// Global Context Panel
// =============================================================================

function GlobalContextPanel({
    value,
    onChange,
    repoRoot,
}: {
    value: string;
    onChange: (value: string) => void;
    repoRoot?: string;
}) {
    return (
        <div className="h-full flex flex-col space-y-3">
            <div className="px-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shadow-[0_0_5px_currentColor]"></span>
                    Global Context Injection
                </p>
                <p className="text-[10px] text-muted-foreground/50 mt-1 pl-3.5">
                    Data appended to every prompt cycle
                </p>
            </div>
            <textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={`Repo: ${repoRoot || '/path/to/repo'}

Files:
- src/
- tests/

Invariants:
- Don't break tests
- Follow code style`}
                className="flex-1 w-full bg-black/20 border border-white/10 rounded-lg p-3 text-[11px] font-mono resize-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 focus:outline-none transition-all placeholder:text-white/10"
            />
        </div>
    );
}

export default InfoSidebar;
