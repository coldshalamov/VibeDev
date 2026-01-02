// =============================================================================
// VibeDev Global State Store (Zustand)
// =============================================================================

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { UIState, JobStatus } from '@/types';

// =============================================================================
// Types
// =============================================================================

interface ViewMode {
  mode: 'research' | 'planning' | 'execution' | 'review';
}

interface SidebarState {
  isOpen: boolean;
  activeSection: 'metadata' | 'invariants' | 'mistakes' | 'context';
}

interface AutomationState {
  isAutoMode: boolean;
  isPaused: boolean;
  autoAdvanceSteps: boolean;
  clipboardBridge: boolean;
}

interface NotificationSettings {
  soundEnabled: boolean;
  desktopNotifications: boolean;
  showToasts: boolean;
}

interface VibeDevState {
  // Current job context
  currentJobId: string | null;
  uiState: UIState | null;

  // View settings
  viewMode: ViewMode;
  sidebar: SidebarState;

  // Automation cockpit
  automation: AutomationState;

  // UI preferences
  theme: 'light' | 'dark' | 'system';
  notifications: NotificationSettings;

  // Step selection for multi-edit
  selectedStepIds: string[];

  // Clipboard for auto-prompter
  lastClipboardContent: string | null;

  // Actions
  setCurrentJob: (jobId: string | null) => void;
  setUIState: (state: UIState | null) => void;
  setViewMode: (mode: ViewMode['mode']) => void;
  toggleSidebar: () => void;
  setSidebarSection: (section: SidebarState['activeSection']) => void;

  // Automation actions
  toggleAutoMode: () => void;
  togglePause: () => void;
  setAutoAdvanceSteps: (enabled: boolean) => void;
  setClipboardBridge: (enabled: boolean) => void;

  // Step selection
  selectStep: (stepId: string) => void;
  deselectStep: (stepId: string) => void;
  clearStepSelection: () => void;
  toggleStepSelection: (stepId: string) => void;

  // Theme
  setTheme: (theme: 'light' | 'dark' | 'system') => void;

  // Clipboard
  setLastClipboardContent: (content: string | null) => void;

  // Computed helpers
  isJobInPlanning: () => boolean;
  isJobExecuting: () => boolean;
  canStartExecution: () => boolean;
  getCurrentStepId: () => string | null;
}

// =============================================================================
// Store Implementation
// =============================================================================

export const useVibeDevStore = create<VibeDevState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        currentJobId: null,
        uiState: null,

        viewMode: { mode: 'planning' },
        sidebar: {
          isOpen: true,
          activeSection: 'metadata',
        },

        automation: {
          isAutoMode: false,
          isPaused: false,
          autoAdvanceSteps: true,
          clipboardBridge: false,
        },

        theme: 'system',
        notifications: {
          soundEnabled: true,
          desktopNotifications: false,
          showToasts: true,
        },

        selectedStepIds: [],
        lastClipboardContent: null,

        // Actions
        setCurrentJob: (jobId) => set({ currentJobId: jobId }),

        setUIState: (state) => {
          // IMPORTANT: UI state is refreshed frequently (polling + SSE). We must
          // not override the user's selected view mode on every refresh.
          const prev = get().uiState;
          const prevJobId = prev?.job.job_id ?? null;
          const prevStatus = prev?.job.status ?? null;

          set({ uiState: state });

          if (!state) return;

          const status = state.job.status as JobStatus;
          const jobChanged = prevJobId !== state.job.job_id;
          const statusChanged = prevStatus !== status;
          const currentMode = get().viewMode.mode;

          // When the user selects a different job, pick a sensible default tab
          // based on job status.
          if (jobChanged) {
            if (status === 'PLANNING') {
              set({ viewMode: { mode: 'planning' } });
            } else if (status === 'EXECUTING' || status === 'READY') {
              set({ viewMode: { mode: 'execution' } });
            } else if (status === 'COMPLETE' || status === 'ARCHIVED') {
              set({ viewMode: { mode: 'review' } });
            }
            return;
          }

          // For the same job, only auto-switch on *status transitions* — and
          // only in the "expected" direction (e.g. planning -> execution).
          if (!statusChanged) return;

          if ((status === 'EXECUTING' || status === 'READY') && currentMode === 'planning') {
            set({ viewMode: { mode: 'execution' } });
          } else if ((status === 'COMPLETE' || status === 'ARCHIVED') && currentMode !== 'review') {
            set({ viewMode: { mode: 'review' } });
          }
        },

        setViewMode: (mode) => set({ viewMode: { mode } }),

        toggleSidebar: () =>
          set((state) => ({
            sidebar: { ...state.sidebar, isOpen: !state.sidebar.isOpen },
          })),

        setSidebarSection: (section) =>
          set((state) => ({
            sidebar: { ...state.sidebar, activeSection: section },
          })),

        // Automation actions
        toggleAutoMode: () =>
          set((state) => ({
            automation: {
              ...state.automation,
              isAutoMode: !state.automation.isAutoMode,
            },
          })),

        togglePause: () =>
          set((state) => ({
            automation: {
              ...state.automation,
              isPaused: !state.automation.isPaused,
            },
          })),

        setAutoAdvanceSteps: (enabled) =>
          set((state) => ({
            automation: { ...state.automation, autoAdvanceSteps: enabled },
          })),

        setClipboardBridge: (enabled) =>
          set((state) => ({
            automation: { ...state.automation, clipboardBridge: enabled },
          })),

        // Step selection
        selectStep: (stepId) =>
          set((state) => ({
            selectedStepIds: [...state.selectedStepIds, stepId],
          })),

        deselectStep: (stepId) =>
          set((state) => ({
            selectedStepIds: state.selectedStepIds.filter((id) => id !== stepId),
          })),

        clearStepSelection: () => set({ selectedStepIds: [] }),

        toggleStepSelection: (stepId) =>
          set((state) => {
            if (state.selectedStepIds.includes(stepId)) {
              return {
                selectedStepIds: state.selectedStepIds.filter((id) => id !== stepId),
              };
            }
            return {
              selectedStepIds: [...state.selectedStepIds, stepId],
            };
          }),

        // Theme
        setTheme: (theme) => set({ theme }),

        // Clipboard
        setLastClipboardContent: (content) => set({ lastClipboardContent: content }),

        // Computed helpers
        isJobInPlanning: () => {
          const { uiState } = get();
          return uiState?.job.status === 'PLANNING';
        },

        isJobExecuting: () => {
          const { uiState } = get();
          return uiState?.job.status === 'EXECUTING';
        },

        canStartExecution: () => {
          const { uiState } = get();
          return uiState?.job.status === 'READY';
        },

        getCurrentStepId: () => {
          const { uiState } = get();
          return uiState?.current_step?.step_id || null;
        },
      }),
      {
        name: 'vibedev-storage',
        // Only persist user preferences, not transient state
        partialize: (state) => ({
          theme: state.theme,
          notifications: state.notifications,
          sidebar: { isOpen: state.sidebar.isOpen },
          automation: {
            autoAdvanceSteps: state.automation.autoAdvanceSteps,
            clipboardBridge: state.automation.clipboardBridge,
          },
        }),
      }
    ),
    { name: 'VibeDev Store' }
  )
);

// =============================================================================
// Selector Hooks for Performance
// =============================================================================

export const useCurrentJob = () => useVibeDevStore((state) => state.uiState?.job);
export const useCurrentSteps = () => useVibeDevStore((state) => state.uiState?.steps);
export const useCurrentStep = () => useVibeDevStore((state) => state.uiState?.current_step);
export const usePlanningPhase = () => useVibeDevStore((state) => state.uiState?.phase);
export const useMistakes = () => useVibeDevStore((state) => state.uiState?.mistakes);
export const useViewMode = () => useVibeDevStore((state) => state.viewMode.mode);
export const useAutomation = () => useVibeDevStore((state) => state.automation);
export const useTheme = () => useVibeDevStore((state) => state.theme);
