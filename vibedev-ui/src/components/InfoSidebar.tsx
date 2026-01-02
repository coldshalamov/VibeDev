// =============================================================================
// Info Sidebar - Research Findings, Mistakes, Dev Log
// =============================================================================

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useVibeDevStore } from '@/stores/useVibeDevStore';
import {
    BookOpenIcon,
    ExclamationTriangleIcon,
    ClockIcon,
    PlusIcon,
    TrashIcon,
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
    const [activeTab, setActiveTab] = useState<'findings' | 'mistakes' | 'log'>('findings');

    // For now, use localStorage. Later can connect to backend.
    const storageKey = `vibedev-info-${currentJobId}`;

    const [findings, setFindings] = useState<ResearchFinding[]>(() => {
        if (typeof window !== 'undefined' && currentJobId) {
            const saved = localStorage.getItem(`${storageKey}-findings`);
            if (saved) try { return JSON.parse(saved); } catch { }
        }
        return [];
    });

    const [mistakes, setMistakes] = useState<Mistake[]>(() => {
        if (typeof window !== 'undefined' && currentJobId) {
            const saved = localStorage.getItem(`${storageKey}-mistakes`);
            if (saved) try { return JSON.parse(saved); } catch { }
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
        <div className="h-full flex flex-col bg-card/50 border-r border-foreground/5">
            {/* Tabs */}
            <div className="flex border-b border-foreground/10">
                <TabButton
                    active={activeTab === 'findings'}
                    onClick={() => setActiveTab('findings')}
                    icon={<BookOpenIcon className="w-4 h-4" />}
                    label="Findings"
                    count={findings.length}
                />
                <TabButton
                    active={activeTab === 'mistakes'}
                    onClick={() => setActiveTab('mistakes')}
                    icon={<ExclamationTriangleIcon className="w-4 h-4" />}
                    label="Mistakes"
                    count={mistakes.length}
                />
                <TabButton
                    active={activeTab === 'log'}
                    onClick={() => setActiveTab('log')}
                    icon={<ClockIcon className="w-4 h-4" />}
                    label="Log"
                    count={logs.length}
                />
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto">
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
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
    count: number;
}) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "flex-1 flex items-center justify-center gap-1 py-2 text-xs font-medium transition-colors",
                active
                    ? "bg-primary/10 text-primary border-b-2 border-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
            )}
        >
            {icon}
            <span className="hidden sm:inline">{label}</span>
            {count > 0 && (
                <span className="ml-1 px-1.5 rounded-full bg-foreground/10 text-[10px]">
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
        <div className="p-3 space-y-3">
            <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                    Research results used for context
                </p>
                <button
                    onClick={() => setAdding(!adding)}
                    className="p-1 hover:bg-primary/10 rounded text-primary"
                >
                    <PlusIcon className="w-4 h-4" />
                </button>
            </div>

            {adding && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-2">
                    <input
                        className="w-full bg-background border border-foreground/10 rounded px-2 py-1 text-sm"
                        placeholder="Finding title..."
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        autoFocus
                    />
                    <textarea
                        className="w-full bg-background border border-foreground/10 rounded px-2 py-1 text-sm h-20 resize-none"
                        placeholder="What was discovered..."
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                    />
                    <div className="flex gap-2">
                        <button onClick={handleAdd} className="btn btn-primary text-xs py-1 px-3">Add</button>
                        <button onClick={() => setAdding(false)} className="btn btn-ghost text-xs py-1 px-3">Cancel</button>
                    </div>
                </div>
            )}

            {findings.length === 0 && !adding ? (
                <div className="text-center py-8 text-muted-foreground">
                    <BookOpenIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No findings yet</p>
                    <p className="text-xs">Research results will appear here</p>
                </div>
            ) : (
                findings.map((f) => (
                    <div key={f.id} className="bg-foreground/5 rounded-lg p-3 group">
                        <div className="flex items-start justify-between gap-2">
                            <div className="font-medium text-sm">{f.title}</div>
                            <button
                                onClick={() => onDelete(f.id)}
                                className="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-red-400 rounded"
                            >
                                <TrashIcon className="w-3 h-3" />
                            </button>
                        </div>
                        {f.content && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{f.content}</p>
                        )}
                        <div className="text-[10px] text-muted-foreground/60 mt-2">
                            From: {f.source}
                        </div>
                    </div>
                ))
            )}
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
        <div className="p-3 space-y-3">
            <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                    Errors and lessons learned
                </p>
                <button
                    onClick={() => setAdding(!adding)}
                    className="p-1 hover:bg-orange-500/10 rounded text-orange-400"
                >
                    <PlusIcon className="w-4 h-4" />
                </button>
            </div>

            {adding && (
                <div className="bg-orange-500/5 border border-orange-500/20 rounded-lg p-3 space-y-2">
                    <input
                        className="w-full bg-background border border-foreground/10 rounded px-2 py-1 text-sm"
                        placeholder="What went wrong..."
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        autoFocus
                    />
                    <textarea
                        className="w-full bg-background border border-foreground/10 rounded px-2 py-1 text-sm h-16 resize-none"
                        placeholder="Details..."
                        value={whatHappened}
                        onChange={(e) => setWhatHappened(e.target.value)}
                    />
                    <textarea
                        className="w-full bg-background border border-foreground/10 rounded px-2 py-1 text-sm h-12 resize-none"
                        placeholder="Lesson learned..."
                        value={lesson}
                        onChange={(e) => setLesson(e.target.value)}
                    />
                    <div className="flex gap-2">
                        <button onClick={handleAdd} className="btn btn-primary text-xs py-1 px-3">Add</button>
                        <button onClick={() => setAdding(false)} className="btn btn-ghost text-xs py-1 px-3">Cancel</button>
                    </div>
                </div>
            )}

            {mistakes.length === 0 && !adding ? (
                <div className="text-center py-8 text-muted-foreground">
                    <ExclamationTriangleIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No mistakes recorded</p>
                    <p className="text-xs">Errors and lessons will appear here</p>
                </div>
            ) : (
                mistakes.map((m) => (
                    <div key={m.id} className="bg-orange-500/5 border border-orange-500/20 rounded-lg p-3 group">
                        <div className="flex items-start justify-between gap-2">
                            <div className="font-medium text-sm text-orange-300">{m.title}</div>
                            <button
                                onClick={() => onDelete(m.id)}
                                className="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-red-400 rounded"
                            >
                                <TrashIcon className="w-3 h-3" />
                            </button>
                        </div>
                        {m.whatHappened && (
                            <p className="text-xs text-muted-foreground mt-1">{m.whatHappened}</p>
                        )}
                        {m.lesson && (
                            <p className="text-xs text-green-400/80 mt-2 italic">💡 {m.lesson}</p>
                        )}
                    </div>
                ))
            )}
        </div>
    );
}

// =============================================================================
// Log Panel
// =============================================================================

function LogPanel({ logs }: { logs: LogEntry[] }) {
    return (
        <div className="p-3 space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                Execution history
            </p>

            {logs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                    <ClockIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No logs yet</p>
                    <p className="text-xs">Execution events will appear here</p>
                </div>
            ) : (
                logs.map((log) => (
                    <div key={log.id} className="flex gap-2 text-xs">
                        <span className="text-muted-foreground/60 font-mono shrink-0">
                            {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                        <span className={cn(
                            log.type === 'error' && 'text-red-400',
                            log.type === 'step' && 'text-primary',
                        )}>
                            {log.message}
                        </span>
                    </div>
                ))
            )}
        </div>
    );
}

export default InfoSidebar;
