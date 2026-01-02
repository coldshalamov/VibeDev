import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { StepNode } from '../components/StepNode';

// Mock @xyflow/react components since they require React Flow context
vi.mock('@xyflow/react', () => ({
    Handle: ({ type }: { type: string }) => <div data-testid={`handle-${type}`} />,
    Position: { Top: 'top', Bottom: 'bottom', Left: 'left', Right: 'right' },
}));

// Mock utils if needed, but cn is usually fine
// vi.mock('@/lib/utils', () => ({ cn: (...args: any[]) => args.join(' ') }));

describe('StepNode', () => {
    const defaultProps = {
        id: 'test-node',
        type: 'step',
        data: {
            title: 'Test Step Title',
            description: 'Test Description',
            instruction: 'Do something',
        },
        selected: false,
        zIndex: 1,
        isConnectable: true,
        positionAbsoluteX: 0,
        positionAbsoluteY: 0,
        dragging: false,
    };

    it('renders the step title', () => {
        // @ts-expect-error - simplifying props for test
        render(<StepNode {...defaultProps} />);
        expect(screen.getByDisplayValue('Test Step Title')).toBeInTheDocument();
    });

    it('renders the instruction preview', () => {
        // @ts-expect-error - NodeProps shape is simplified for test
        render(<StepNode {...defaultProps} />);
        expect(screen.getByText('Do something')).toBeInTheDocument();
    });

    it('shows styling for selected state', () => {
        // @ts-expect-error - NodeProps shape is simplified for test
        const { container } = render(<StepNode {...defaultProps} selected={true} />);
        // Check for border-primary which indicates selection
        const node = container.firstChild;
        expect(node).toHaveClass('border-primary');
    });

    it('does not render top handle for start node', () => {
        const props = {
            ...defaultProps,
            data: { ...defaultProps.data, isStart: true }
        };
        // @ts-expect-error - NodeProps shape is simplified for test
        render(<StepNode {...props} />);
        expect(screen.queryByTestId('handle-target')).not.toBeInTheDocument();
    });

    it('renders handles for normal node', () => {
        // @ts-expect-error - NodeProps shape is simplified for test
        render(<StepNode {...defaultProps} />);
        expect(screen.getByTestId('handle-target')).toBeInTheDocument();
        expect(screen.getByTestId('handle-source')).toBeInTheDocument();
    });
});
