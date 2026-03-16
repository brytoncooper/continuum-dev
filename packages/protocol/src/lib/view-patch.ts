import type { ViewNode } from '@continuum-dev/contract';

export interface ContinuumViewPatchPosition {
  index?: number;
  beforeId?: string;
  afterId?: string;
}

export type ContinuumViewPatchOperation =
  | {
      op: 'insert-node';
      parentId?: string | null;
      position?: ContinuumViewPatchPosition;
      node: ViewNode;
    }
  | {
      op: 'move-node';
      nodeId: string;
      parentId?: string | null;
      position?: ContinuumViewPatchPosition;
    }
  | {
      op: 'wrap-nodes';
      parentId?: string | null;
      nodeIds: string[];
      wrapper: ViewNode;
    }
  | {
      op: 'replace-node';
      nodeId: string;
      node: ViewNode;
    }
  | {
      op: 'remove-node';
      nodeId: string;
    };

export interface ContinuumViewPatch {
  viewId?: string;
  version?: string;
  operations: ContinuumViewPatchOperation[];
}
