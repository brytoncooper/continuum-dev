import type { ViewNode } from '@continuum-dev/contract';

export interface ContinuumViewPatchPosition {
  index?: number;
  beforeId?: string;
  afterId?: string;
  beforeSemanticKey?: string;
  afterSemanticKey?: string;
}

export type ContinuumViewPatchOperation =
  | {
      op: 'insert-node';
      parentId?: string | null;
      parentSemanticKey?: string | null;
      position?: ContinuumViewPatchPosition;
      node: ViewNode;
    }
  | {
      op: 'move-node';
      nodeId?: string;
      semanticKey?: string;
      parentId?: string | null;
      parentSemanticKey?: string | null;
      position?: ContinuumViewPatchPosition;
    }
  | {
      op: 'wrap-nodes';
      parentId?: string | null;
      parentSemanticKey?: string | null;
      nodeIds?: string[];
      semanticKeys?: string[];
      wrapper: ViewNode;
    }
  | {
      op: 'replace-node';
      nodeId?: string;
      semanticKey?: string;
      node: ViewNode;
    }
  | {
      op: 'remove-node';
      nodeId?: string;
      semanticKey?: string;
    }
  | {
      op: 'append-content';
      nodeId?: string;
      semanticKey?: string;
      text: string;
    };

export interface ContinuumViewPatch {
  viewId?: string;
  version?: string;
  operations: ContinuumViewPatchOperation[];
}
