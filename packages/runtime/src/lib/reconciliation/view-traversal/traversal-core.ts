import { getChildNodes, type ViewNode } from '@continuum-dev/contract';
import { cycleDetectedIssue, depthExceededIssue } from './issue-factories.js';
import { toIndexedId } from './path-utils.js';
import type {
  EnterFrame,
  TraverseViewInput,
  TraverseViewResult,
  TraversalFrame,
} from './types.js';

const DEFAULT_MAX_VIEW_DEPTH = 128;

export function traverseViewNodesCore(
  input: TraverseViewInput
): TraverseViewResult {
  const maxDepth = input.maxDepth ?? DEFAULT_MAX_VIEW_DEPTH;
  const visited: TraverseViewResult['visited'] = [];
  const issues: TraverseViewResult['issues'] = [];
  const active = new Set<ViewNode>();
  const stack: TraversalFrame[] = [];

  seedRootFrames({ nodes: input.nodes, stack });

  while (stack.length > 0) {
    const frame = stack.pop();
    if (!frame) {
      continue;
    }
    if (frame.kind === 'exit') {
      active.delete(frame.node);
      continue;
    }

    const nodeId = toIndexedId(frame.node.id, frame.parentPath);

    if (frame.depth > maxDepth) {
      issues.push(depthExceededIssue({ nodeId, maxDepth }));
      continue;
    }

    if (active.has(frame.node)) {
      issues.push(cycleDetectedIssue({ nodeId, nodeRawId: frame.node.id }));
      continue;
    }

    active.add(frame.node);
    visited.push({
      node: frame.node,
      parentPath: frame.parentPath,
      nodeId,
      depth: frame.depth,
      positionPath: frame.positionPath,
    });

    stack.push({ kind: 'exit', node: frame.node });
    pushChildEnterFrames({
      children: getChildNodes(frame.node),
      parentNodeId: nodeId,
      parentDepth: frame.depth,
      parentPositionPath: frame.positionPath,
      stack,
    });
  }

  return { visited, issues };
}

function seedRootFrames(input: {
  nodes: ViewNode[];
  stack: TraversalFrame[];
}): void {
  for (let i = input.nodes.length - 1; i >= 0; i--) {
    input.stack.push({
      kind: 'enter',
      node: input.nodes[i],
      parentPath: '',
      depth: 0,
      positionPath: `${i}`,
    });
  }
}

interface PushChildEnterFramesInput {
  children: ViewNode[];
  parentNodeId: string;
  parentDepth: number;
  parentPositionPath: string;
  stack: TraversalFrame[];
}

function pushChildEnterFrames(input: PushChildEnterFramesInput): void {
  for (let i = input.children.length - 1; i >= 0; i--) {
    const frame: EnterFrame = {
      kind: 'enter',
      node: input.children[i],
      parentPath: input.parentNodeId,
      depth: input.parentDepth + 1,
      positionPath: `${input.parentPositionPath}.${i}`,
    };
    input.stack.push(frame);
  }
}
