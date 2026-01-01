// =============================================================================
// Clipboard Bridge Hook - Auto-copy prompts for external AI assistants
// =============================================================================

import { useEffect, useCallback } from 'react';
import { useVibeDevStore } from '@/stores/useVibeDevStore';
import { getNextStepPrompt } from '@/lib/api';

/**
 * Hook that automatically copies the current step's instruction prompt
 * to the clipboard when the clipboard bridge is enabled.
 *
 * This enables a workflow where users can quickly paste prompts into
 * external AI assistants (Claude, ChatGPT, etc.) while VibeDev tracks progress.
 */
export function useClipboardBridge() {
  const uiState = useVibeDevStore((state) => state.uiState);
  const automation = useVibeDevStore((state) => state.automation);
  const setLastClipboardContent = useVibeDevStore((state) => state.setLastClipboardContent);
  const lastClipboardContent = useVibeDevStore((state) => state.lastClipboardContent);

  const currentStep = uiState?.current_step;
  const clipboardBridgeEnabled = automation.clipboardBridge;

  // Copy to clipboard function
  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setLastClipboardContent(text);
      return true;
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      return false;
    }
  }, [setLastClipboardContent]);

  // Auto-copy when step changes and bridge is enabled
  useEffect(() => {
    const jobId = uiState?.job?.job_id;
    if (!clipboardBridgeEnabled || !currentStep?.instruction_prompt || !jobId) {
      return;
    }

    let cancelled = false;

    const copy = async () => {
      try {
        const stepPrompt = await getNextStepPrompt(jobId);
        const prompt = stepPrompt.prompt || currentStep.instruction_prompt;
        if (!cancelled && prompt !== lastClipboardContent) {
          await copyToClipboard(prompt);
        }
      } catch {
        const prompt = currentStep.instruction_prompt;
        if (!cancelled && prompt !== lastClipboardContent) {
          await copyToClipboard(prompt);
        }
      }
    };

    copy();

    return () => {
      cancelled = true;
    };
  }, [
    currentStep?.step_id,
    currentStep?.instruction_prompt,
    clipboardBridgeEnabled,
    lastClipboardContent,
    copyToClipboard,
    uiState?.job?.job_id,
  ]);

  // Manual copy function for UI buttons
  const copyCurrentPrompt = useCallback(() => {
    if (currentStep?.instruction_prompt) {
      return copyToClipboard(currentStep.instruction_prompt);
    }
    return Promise.resolve(false);
  }, [currentStep?.instruction_prompt, copyToClipboard]);

  // Copy formatted prompt with context
  const copyFormattedPrompt = useCallback(() => {
    if (!currentStep) return Promise.resolve(false);

    const job = uiState?.job;
    const invariants = job?.invariants || [];

    let formattedPrompt = '';

    // Add job context header
    formattedPrompt += `# Task: ${job?.title || 'Unknown'}\n\n`;

    // Add invariants if any
    if (invariants.length > 0) {
      formattedPrompt += `## Invariants (MUST follow)\n`;
      invariants.forEach((inv: string) => {
        formattedPrompt += `- ${inv}\n`;
      });
      formattedPrompt += '\n';
    }

    // Add step info
    formattedPrompt += `## Current Step: ${currentStep.title}\n\n`;
    formattedPrompt += currentStep.instruction_prompt;

    // Add acceptance criteria if any
    if (currentStep.acceptance_criteria?.length > 0) {
      formattedPrompt += '\n\n## Acceptance Criteria\n';
      currentStep.acceptance_criteria.forEach((c: string) => {
        formattedPrompt += `- [ ] ${c}\n`;
      });
    }

    // Add required evidence if any
    if (currentStep.required_evidence?.length > 0) {
      formattedPrompt += '\n## Required Evidence\n';
      currentStep.required_evidence.forEach((e: string) => {
        formattedPrompt += `- ${e}\n`;
      });
    }

    return copyToClipboard(formattedPrompt);
  }, [currentStep, uiState?.job, copyToClipboard]);

  return {
    copyCurrentPrompt,
    copyFormattedPrompt,
    lastClipboardContent,
    isEnabled: clipboardBridgeEnabled,
  };
}

/**
 * Hook to read from clipboard - useful for capturing evidence
 */
export function useClipboardReader() {
  const readClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      return text;
    } catch (error) {
      console.error('Failed to read from clipboard:', error);
      return null;
    }
  }, []);

  return { readClipboard };
}
