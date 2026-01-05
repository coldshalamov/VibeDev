import { useSyncExternalStore } from 'react';

type JobEvent = {
  type: string;
  timestamp?: string;
  job_id?: string;
  data?: any;
};

type StepEventIndex = Record<string, JobEvent[]>;

class JobEventBus {
  private listeners = new Set<() => void>();
  private byStep: StepEventIndex = {};
  private maxPerStep = 12;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.byStep;

  push(event: JobEvent) {
    const stepId = String(event?.data?.step_id || event?.data?.related_step_id || event?.data?.stepId || '');
    if (!stepId) return;

    const prev = this.byStep[stepId] || [];
    const next = [event, ...prev].slice(0, this.maxPerStep);
    this.byStep = { ...this.byStep, [stepId]: next };

    for (const l of this.listeners) l();
  }
}

export const jobEventBus = new JobEventBus();

export function useJobStepEvents(stepId: string | null | undefined): JobEvent[] {
  const index = useSyncExternalStore(jobEventBus.subscribe, jobEventBus.getSnapshot);
  if (!stepId) return [];
  return index[String(stepId)] || [];
}

