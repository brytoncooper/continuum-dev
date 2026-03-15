import type { ViewNode } from '@continuum-dev/contract';
import type { ReconciliationIssue } from '../../types.js';

export interface TraversedViewNode {
  node: ViewNode;
  parentPath: string;
  nodeId: string;
  depth: number;
  positionPath: string;
}

export interface TraverseViewInput {
  nodes: ViewNode[];
  maxDepth?: number;
}

export interface TraverseViewResult {
  visited: TraversedViewNode[];
  issues: ReconciliationIssue[];
}

export interface EnterFrame {
  kind: 'enter';
  node: ViewNode;
  parentPath: string;
  depth: number;
  positionPath: string;
}

export interface ExitFrame {
  kind: 'exit';
  node: ViewNode;
}

export type TraversalFrame = EnterFrame | ExitFrame;
