import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  addEdge,
  Background,
  BackgroundVariant,
  type Connection,
  Controls,
  type Edge,
  MiniMap,
  type Node,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ArrowPathIcon, PlusIcon } from '@heroicons/react/24/outline';

import { useProposeSteps } from '@/hooks/useUIState';
import { saveUIState } from '@/lib/api';
import { StepNode, type StepNodeData } from './StepNode';
import { TemplateSidebar, type WorkflowTemplatePayload } from './TemplateSidebar';

const nodeTypes = { step: StepNode } as any;

const startNode: Node = {
  id: 'start',
  type: 'step',
  position: { x: 250, y: 50 },
  data: { title: 'Start', isStart: true, instruction: 'Initialize process' },
};

const initialNodes: Node[] = [startNode];

function parseLines(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((x) => typeof x === 'string' && x.trim());
  if (typeof value !== 'string') return [];
  return value
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean);
}

export function FlowCanvas({
  jobId,
  initialSteps,
  initialGraphState,
  onStepsChange,
}: {
  jobId: string;
  initialSteps?: any[];
  initialGraphState?: { nodes: any[]; edges: any[]; viewport: any };
  onStepsChange?: (steps: any[]) => void;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [rfInstance, setRfInstance] = useState<any>(null);

  const proposeStepsMutation = useProposeSteps(jobId);

  const getId = useCallback(() => `step_${nextId.current++}`, []);

  const updateNodeData = useCallback(
    (nodeId: string, patch: Partial<StepNodeData>) => {
      setNodes((nds) => {
        const nextNodes = nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n));
        // We could call onStepsChange here but that might be noisy. 
        // Better to rely on a generic effect or call it specifically on significant changes.
        return nextNodes;
      });
    },
    [setNodes]
  );

  const deleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    },
    [setEdges, setNodes]
  );

  const withHandlers = useCallback(
    (node: Node): Node => {
      if (node.id === 'start') return node;
      return {
        ...node,
        data: {
          acceptance_criteria: '',
          required_evidence: '',
          ...node.data,
          onChange: (patch: Partial<StepNodeData>) => updateNodeData(node.id, patch),
          onDelete: () => deleteNode(node.id),
        },
      };
    },
    [deleteNode, updateNodeData]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const raw = event.dataTransfer.getData('application/vibedev-template');
      if (!raw) return;

      let payload: WorkflowTemplatePayload | null = null;
      try {
        payload = JSON.parse(raw) as WorkflowTemplatePayload;
      } catch {
        return;
      }

      const position = rfInstance?.screenToFlowPosition
        ? rfInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY })
        : { x: event.clientX, y: event.clientY };

      if (payload.type === 'node') {
        const nodeId = getId();
        const node: Node = withHandlers({
          id: nodeId,
          type: 'step',
          position,
          data: {
            title: payload.data.title ?? 'New Step',
            instruction: payload.data.instruction ?? '',
            acceptance_criteria: payload.data.acceptance_criteria ?? '',
            required_evidence: payload.data.required_evidence ?? '',
          },
        });
        setNodes((nds) => nds.concat(node));
        return;
      }

      if (payload.type === 'graph') {
        const idMap = new Map<string, string>();
        const createdNodes: Node[] = payload.nodes.map((n, idx) => {
          const nodeId = getId();
          idMap.set(n.id, nodeId);

          return withHandlers({
            id: nodeId,
            type: 'step',
            position: {
              x: position.x + (idx % 2) * 320,
              y: position.y + Math.floor(idx / 2) * 240,
            },
            data: {
              title: n.data.title ?? 'Step',
              instruction: n.data.instruction ?? '',
              acceptance_criteria: n.data.acceptance_criteria ?? '',
              required_evidence: n.data.required_evidence ?? '',
            },
          });
        });

        const createdEdges: Edge[] = payload.edges
          .map((e, idx) => {
            const source = idMap.get(e.source);
            const target = idMap.get(e.target);
            if (!source || !target) return null;
            return {
              id: `e_${source}_${target}_${idx}`,
              source,
              target,
              animated: true,
              style: { stroke: 'rgba(59,130,246,0.6)' },
            } satisfies Edge;
          })
          .filter(Boolean) as Edge[];

        setNodes((nds) => nds.concat(createdNodes));
        setEdges((eds) => eds.concat(createdEdges));
      }
    },
    [getId, rfInstance, setEdges, setNodes, withHandlers]
  );

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onAddNode = useCallback(() => {
    const nodeId = getId();
    const newNode: Node = withHandlers({
      id: nodeId,
      type: 'step',
      position: {
        x: 240 + Math.random() * 220,
        y: 180 + Math.random() * 240,
      },
      data: {
        title: `Step ${nodeId.replace('step_', '')}`,
        instruction: '',
        status: 'PENDING',
        acceptance_criteria: '',
        required_evidence: '',
      },
    });

    setNodes((nds) => nds.concat(newNode));
    setEdges((eds) =>
      eds.concat({
        id: `e_start_${nodeId}`,
        source: 'start',
        target: nodeId,
        animated: true,
        style: { stroke: 'rgba(59,130,246,0.6)' },
      })
    );
  }, [getId, setEdges, setNodes, withHandlers]);

  // Sync back to parent if requested
  useEffect(() => {
    if (!onStepsChange) return;

    // Build path from 'start'
    const adj = new Map<string, string>();
    edges.forEach((e) => adj.set(e.source, e.target));

    const orderedNodes: Node[] = [];
    let curr = 'start';
    const visited = new Set<string>();

    while (curr && !visited.has(curr)) {
      visited.add(curr);
      const next = adj.get(curr);
      if (!next) break;

      const node = nodes.find(n => n.id === next);
      if (node) {
        orderedNodes.push(node);
        curr = next;
      } else {
        break;
      }
    }

    const currentSteps = orderedNodes
      .filter((n) => n.id !== 'start')
      .map((n) => ({
        id: n.id,
        title: n.data.title || '',
        instruction_prompt: n.data.instruction || '',
        acceptance_criteria: (n.data as any).acceptance_criteria || '',
        required_evidence: (n.data as any).required_evidence || '',
      }));

    onStepsChange(currentSteps);
  }, [nodes, edges, onStepsChange]);

  const onSave = useCallback(async () => {
    // Build path from 'start'
    const adj = new Map<string, string>();
    edges.forEach((e) => adj.set(e.source, e.target));

    const orderedNodes: Node[] = [];
    let curr = 'start';
    const visited = new Set<string>();

    // Linear traversal from start
    while (curr && !visited.has(curr)) {
      visited.add(curr);
      const next = adj.get(curr);
      if (!next) break;

      const node = nodes.find(n => n.id === next);
      if (node) {
        orderedNodes.push(node);
        curr = next;
      } else {
        break;
      }
    }

    const validNodes = orderedNodes
      .filter((n) => n.id !== 'start')
      .filter((n) => Boolean(n.data?.title) && Boolean(n.data?.instruction))
      .map((n) => ({
        step_id: n.id,
        title: n.data.title as string,
        instruction_prompt: n.data.instruction as string,
        acceptance_criteria: parseLines((n.data as any).acceptance_criteria),
        required_evidence: parseLines((n.data as any).required_evidence),
      }));

    if (validNodes.length > 0) {
      // Save logical plan
      await proposeStepsMutation.mutateAsync(validNodes);

      // Save visual state
      if (rfInstance) {
        await saveUIState(jobId, {
          nodes: nodes.map(n => ({
            ...n,
            // Strip handlers or circular types if necessary, though React Flow nodes are usually JSON clean
            data: {
              ...n.data,
              // Ensure functions are removed if any (StepNodeData has handlers)
              onChange: undefined,
              onDelete: undefined
            }
          })),
          edges,
          viewport: rfInstance.getViewport(),
        });
      }
    }
  }, [nodes, edges, proposeStepsMutation, jobId, rfInstance]);

  // Initialization logic
  useEffect(() => {
    // If we have saved graph state, use it!
    if (initialGraphState && initialGraphState.nodes && initialGraphState.nodes.length > 0) {
      setNodes(initialGraphState.nodes.map(n => ({
        ...n,
        position: n.position || { x: 0, y: 0 },
        data: {
          ...n.data,
          status: initialSteps?.find(s => s.step_id === n.id)?.status || n.data?.status || 'PENDING'
        }
      })));
      setEdges(initialGraphState.edges || []);

      if (initialGraphState.viewport && rfInstance) {
        rfInstance.setViewport(initialGraphState.viewport);
      }
      return;
    }

    // Fallback to seed from step list
    if (!initialSteps || initialSteps.length === 0) return;

    const seededStepNodes: Node[] = initialSteps.map((s: any, idx: number) => ({
      id: s.step_id ?? getId(),
      type: 'step',
      position: { x: 250, y: 160 + idx * 180 },
      data: {
        title: s.title ?? `Step ${idx + 1}`,
        instruction: s.instruction_prompt ?? '',
        status: s.status || 'PENDING',
        acceptance_criteria: Array.isArray(s.acceptance_criteria)
          ? s.acceptance_criteria.join('\n')
          : '',
        required_evidence: Array.isArray(s.required_evidence) ? s.required_evidence.join('\n') : '',
      },
    }));

    const seededEdges: Edge[] = seededStepNodes.map((n, idx: number) => {
      const prevId = idx === 0 ? 'start' : seededStepNodes[idx - 1].id;
      return {
        id: `e_${prevId}_${n.id}`,
        source: prevId,
        target: n.id,
        animated: true,
        style: { stroke: 'rgba(59,130,246,0.6)' },
      };
    });

    setNodes([startNode, ...seededStepNodes]);
    setEdges(seededEdges);
  }, [getId, initialSteps, initialGraphState, setEdges, setNodes, rfInstance]);

  const flowPanel = useMemo(
    () => (
      <Panel position="top-right" className="flex gap-2">
        <button
          onClick={onAddNode}
          className="btn btn-primary shadow-lg shadow-primary/20 flex items-center gap-2 active:scale-95 transition-transform"
        >
          <PlusIcon className="w-4 h-4" /> Add Step
        </button>
        <button
          onClick={onSave}
          disabled={proposeStepsMutation.isPending}
          className="btn bg-green-600 hover:bg-green-700 text-white shadow-lg flex items-center gap-2 active:scale-95 transition-transform"
        >
          <ArrowPathIcon className={proposeStepsMutation.isPending ? 'w-4 h-4 animate-spin' : 'w-4 h-4'} />{' '}
          Save Workflow
        </button>
      </Panel>
    ),
    [onAddNode, onSave, proposeStepsMutation.isPending]
  );

  return (
    <div
      className="h-full w-full glass-panel overflow-hidden relative flex"
      style={{ height: '70vh' }}
      ref={wrapperRef}
    >
      <TemplateSidebar />
      <div className="flex-1 min-w-0">
        <ReactFlow
          nodes={nodes.map(withHandlers)}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onInit={setRfInstance}
          nodeTypes={nodeTypes}
          onDrop={onDrop}
          onDragOver={onDragOver}
          fitView
          className="bg-transparent"
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={12}
            size={1}
            color="rgba(255, 255, 255, 0.1)"
          />
          <Controls className="bg-white/5 border border-white/10 fill-white text-white" />
          <MiniMap
            className="bg-black/40 border border-white/10 rounded-lg"
            nodeColor={() => '#3b82f6'}
            maskColor="rgba(0, 0, 0, 0.3)"
          />
          {flowPanel}
        </ReactFlow>
      </div>
    </div>
  );
}

type FlowCanvasWrapperProps = {
  jobId: string;
  initialSteps?: any[];
  initialGraphState?: { nodes: any[]; edges: any[]; viewport: any };
  onStepsChange?: (steps: any[]) => void;
};

export default function FlowCanvasWrapper(props: FlowCanvasWrapperProps) {
  return (
    <ReactFlowProvider>
      <FlowCanvas {...props} />
    </ReactFlowProvider>
  );
}
