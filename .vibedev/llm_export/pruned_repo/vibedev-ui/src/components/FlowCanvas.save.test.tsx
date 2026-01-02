import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { FlowCanvas } from './FlowCanvas';

const mutateAsync = vi.fn().mockResolvedValue(undefined);

vi.mock('@/hooks/useUIState', () => {
  return {
    useProposeSteps: () => ({
      mutateAsync,
      isPending: false,
    }),
  };
});

vi.mock('@xyflow/react', async () => {
  const mockNodes = [
    {
      id: 'start',
      type: 'step',
      position: { x: 0, y: 0 },
      data: { title: 'Start', isStart: true, instruction: 'Initialize process' },
    },
    {
      id: 'step_1',
      type: 'step',
      position: { x: 0, y: 100 },
      data: {
        title: 'Step 1',
        instruction: 'Do the thing',
        acceptance_criteria: 'Gate A\nGate B',
        required_evidence: 'tests_run\ntests_passed',
      },
    },
  ];

  const mockEdges = [
    {
      id: 'e_start_step_1',
      source: 'start',
      target: 'step_1',
      animated: true,
    },
  ];

  return {
    ReactFlow: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="reactflow">{children}</div>
    ),
    ReactFlowProvider: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    MiniMap: () => <div data-testid="minimap" />,
    Controls: () => <div data-testid="controls" />,
    Background: () => <div data-testid="background" />,
    Panel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    BackgroundVariant: { Dots: 'Dots' },
    addEdge: (params: unknown, edges: unknown[]) => [...edges, params],
    useNodesState: () => [mockNodes, vi.fn(), vi.fn()],
    useEdgesState: () => [mockEdges, vi.fn(), vi.fn()],
  };
});

describe('FlowCanvas save logic', () => {
  it('parses newline-separated acceptance_criteria and required_evidence into arrays', async () => {
    const user = userEvent.setup();

    render(<FlowCanvas jobId="JOB_1" />);

    await user.click(screen.getByRole('button', { name: /save workflow/i }));

    expect(mutateAsync).toHaveBeenCalledTimes(1);
    expect(mutateAsync).toHaveBeenCalledWith([
      expect.objectContaining({
        title: 'Step 1',
        instruction_prompt: 'Do the thing',
        acceptance_criteria: ['Gate A', 'Gate B'],
        required_evidence: ['tests_run', 'tests_passed'],
      }),
    ]);
  });
});
