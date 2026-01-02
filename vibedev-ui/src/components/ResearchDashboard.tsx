
import { useUIState } from '@/hooks/useUIState';
import { useVibeDevStore } from '@/stores/useVibeDevStore';

export function ResearchDashboard() {
    const currentJobId = useVibeDevStore((state) => state.currentJobId);
    const { data: uiState } = useUIState(currentJobId);

    if (!uiState) return null;

    return (
        <div className="h-full p-6 flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Research & Context</h1>
                    <p className="text-muted-foreground">
                        Gather information, analyze docs, and prepare the "Vibe" for your project.
                    </p>
                </div>
                <button className="btn btn-primary">
                    start New Research Session
                </button>
            </div>

            <div className="grid grid-cols-3 gap-6 flex-1">
                {/* Context Blocks */}
                <div className="col-span-2 panel flex flex-col">
                    <div className="panel-header">
                        <h3 className="panel-title">Knowledge Base</h3>
                    </div>
                    <div className="flex-1 p-4 bg-muted/20 flex items-center justify-center text-muted-foreground">
                        <p>Research agent integration coming soon...</p>
                    </div>
                </div>

                {/* Quick Links / Docs */}
                <div className="space-y-6">
                    <div className="panel">
                        <div className="panel-header">
                            <h3 className="panel-title">Repo Context</h3>
                        </div>
                        <div className="p-4">
                            <ul className="space-y-2 text-sm">
                                {uiState.repo_map?.slice(0, 5).map((entry: any) => (
                                    <li key={entry.path} className="truncate">{entry.path}</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
