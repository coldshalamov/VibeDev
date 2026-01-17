import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

interface GateResult {
  gate_type: string;
  passed: boolean;
  description: string;
  details?: string | null;
  output?: string | null;
  exit_code?: number | null;
}

interface GateResultsPanelProps {
  jobId: string;
  stepId: string;
  attemptId: string;
  gateResults: GateResult[];
}

export function GateResultsPanel({ jobId, stepId, attemptId, gateResults }: GateResultsPanelProps) {
  const [expandedOutputs, setExpandedOutputs] = useState<Record<number, boolean>>({});

  if (!gateResults || gateResults.length === 0) {
    return (
      <div className="text-sm text-muted-foreground/60 italic">
        No gates configured for this step
      </div>
    );
  }

  const toggleOutput = (index: number) => {
    setExpandedOutputs(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-foreground flex items-center gap-2">
        <span>Gate Results</span>
        <span className="text-xs font-normal text-muted-foreground">
          ({gateResults.filter(r => r.passed).length}/{gateResults.length} passed)
        </span>
      </h3>
      
      <div className="space-y-2">
        {gateResults.map((result, index) => (
          <div
            key={index}
            className={cn(
              'border rounded-lg p-3 transition-colors',
              result.passed
                ? 'bg-green-500/10 border-green-500/20'
                : 'bg-red-500/10 border-red-500/20'
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1">
                <div className="mt-0.5">
                  {result.passed ? (
                    <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                      <span className="text-white text-xs">✓</span>
                    </div>
                  ) : (
                    <div className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
                      <span className="text-white text-xs">✕</span>
                    </div>
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">
                      {result.gate_type}
                    </span>
                    <span className={cn(
                      'text-xs font-medium px-2 py-0.5 rounded',
                      result.passed
                        ? 'bg-green-500/20 text-green-700 dark:text-green-300'
                        : 'bg-red-500/20 text-red-700 dark:text-red-300'
                    )}>
                      {result.passed ? 'PASS' : 'FAIL'}
                    </span>
                  </div>
                  
                  <p className="text-sm text-foreground mt-1">
                    {result.description}
                  </p>
                  
                  {result.details && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Details: {result.details}
                    </p>
                  )}
                  
                  {result.output && (
                    <div className="mt-2">
                      <button
                        onClick={() => toggleOutput(index)}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {expandedOutputs[index] ? (
                          <ChevronDownIcon className="w-3 h-3" />
                        ) : (
                          <ChevronRightIcon className="w-3 h-3" />
                        )}
                        {expandedOutputs[index] ? 'Hide' : 'Show'} Output
                      </button>
                      
                      {expandedOutputs[index] && (
                        <pre className="mt-2 text-xs font-mono bg-black/5 dark:bg-black/30 p-3 rounded overflow-x-auto max-h-64 overflow-y-auto">
                          {result.output}
                        </pre>
                      )}
                    </div>
                  )}
                  
                  {result.exit_code !== null && result.exit_code !== undefined && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Exit Code: {result.exit_code}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <div className="text-xs text-muted-foreground/60">
        Attempt: {attemptId}
      </div>
    </div>
  );
}

// Loading state component
export function GateResultsPanelSkeleton() {
  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-foreground">Gate Results</h3>
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="border rounded-lg p-3 animate-pulse">
            <div className="flex items-start gap-3">
              <div className="w-4 h-4 rounded-full bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-muted rounded w-24" />
                <div className="h-3 bg-muted rounded w-full" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}