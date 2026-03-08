import {
  getChildNodes,
  ISSUE_CODES,
  ISSUE_SEVERITY,
  type ViewNode,
} from '@continuum-dev/contract';
import type { ReconciliationIssue } from '../types.js';

const DEFAULT_MAX_VIEW_DEPTH = 128;

export interface TraversedViewNode {
  node: ViewNode;
  parentPath: string;
  nodeId: string;
  depth: number;
  positionPath: string;
}

interface EnterFrame {
  kind: 'enter';
  node: ViewNode;
  parentPath: string;
  depth: number;
  positionPath: string;
}

interface ExitFrame {
  kind: 'exit';
  node: ViewNode;
}

export function traverseViewNodes(
  nodes: ViewNode[],
  maxDepth = DEFAULT_MAX_VIEW_DEPTH
): { visited: TraversedViewNode[]; issues: ReconciliationIssue[] } {
  const visited: TraversedViewNode[] = [];
  const issues: ReconciliationIssue[] = [];
  const active = new Set<ViewNode>();
  const stack: Array<EnterFrame | ExitFrame> = [];

  for (let i = nodes.length - 1; i >= 0; i--) {
    stack.push({
      kind: 'enter',
      node: nodes[i],
      parentPath: '',
      depth: 0,
      positionPath: `${i}`,
    });
  }

  while (stack.length > 0) {
    const frame = stack.pop();
    if (!frame) {
      continue;
    }

    if (frame.kind === 'exit') {
      active.delete(frame.node);
      continue;
    }

    if (frame.depth > maxDepth) {
      issues.push({
        severity: ISSUE_SEVERITY.ERROR,
        nodeId: toIndexedId(frame.node.id, frame.parentPath),
        message: `View node depth exceeds max depth of ${maxDepth}`,
        code: ISSUE_CODES.VIEW_MAX_DEPTH_EXCEEDED,
      });
      continue;
    }

    if (active.has(frame.node)) {
      issues.push({
        severity: ISSUE_SEVERITY.ERROR,
        nodeId: toIndexedId(frame.node.id, frame.parentPath),
        message: `Cycle detected while traversing children for node ${frame.node.id}`,
        code: ISSUE_CODES.VIEW_CHILD_CYCLE_DETECTED,
      });
      continue;
    }

    active.add(frame.node);
    const nodeId = toIndexedId(frame.node.id, frame.parentPath);
    visited.push({
      node: frame.node,
      parentPath: frame.parentPath,
      nodeId,
      depth: frame.depth,
      positionPath: frame.positionPath,
    });

    stack.push({ kind: 'exit', node: frame.node });

    const children = getChildNodes(frame.node);
    for (let i = children.length - 1; i >= 0; i--) {
      stack.push({
        kind: 'enter',
        node: children[i],
        parentPath: nodeId,
        depth: frame.depth + 1,
        positionPath: `${frame.positionPath}.${i}`,
      });
    }
  }

  return { visited, issues };
}

function toIndexedId(id: string, parentPath: string): string {
  if (parentPath.length > 0) {
    return `${parentPath}/${id}`;
  }
  return id;
}
