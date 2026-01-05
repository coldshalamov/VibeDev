import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from './useUIState';
import { jobEventBus } from './jobEventBus';

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL ?? '';
const API_PREFIX = (import.meta as any).env?.VITE_API_PREFIX ?? '/api';
const API_BASE = `${API_BASE_URL}${API_PREFIX}`;

export function useJobEvents(jobId: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!jobId) return;

    const es = new EventSource(`${API_BASE}/jobs/${jobId}/events`);

    es.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as { type: string; data?: any; timestamp?: string; job_id?: string };
        jobEventBus.push(parsed);
        if (parsed.type === 'job_updated' || parsed.type === 'phase_changed') {
          queryClient.invalidateQueries({ queryKey: queryKeys.uiState(jobId) });
          queryClient.invalidateQueries({ queryKey: queryKeys.jobsList() });
          queryClient.invalidateQueries({ queryKey: ['jobs', jobId, 'context'] });
        } else {
          queryClient.invalidateQueries({ queryKey: queryKeys.uiState(jobId) });
          queryClient.invalidateQueries({ queryKey: ['jobs', jobId, 'context'] });
        }
      } catch {
        queryClient.invalidateQueries({ queryKey: queryKeys.uiState(jobId) });  
        queryClient.invalidateQueries({ queryKey: ['jobs', jobId, 'context'] });
      }
    };

    es.onerror = () => {
      // Browser will auto-retry; keep the connection open unless the component unmounts.
    };

    return () => es.close();
  }, [jobId, queryClient]);
}
