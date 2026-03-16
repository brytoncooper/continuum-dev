import type { ViewNode } from '@continuum-dev/core';
import type { ContinuumViewPatchPosition } from '@continuum-dev/runtime/state-ops';

export interface PatchNodeHint {
  path: string;
  id: string;
  parentPath?: string;
  key?: string;
  semanticKey?: string;
  type?: string;
  label?: string;
  description?: string;
  columns?: number;
  layout?: string;
  defaultValue?: unknown;
  childrenCount?: number;
  hasTemplate?: boolean;
}

export interface CompactPatchNode {
  id: string;
  type: string;
  key?: string;
  semanticKey?: string;
  label?: string;
  description?: string;
  placeholder?: string;
  dataType?: string;
  contentType?: string;
  content?: string;
  intentId?: string;
  min?: number;
  max?: number;
  step?: number;
  columns?: number;
  layout?: string;
  defaultValue?: unknown;
  defaultValues?: unknown[];
  options?: Array<{ value: string; label: string }>;
  children?: CompactPatchNode[];
  template?: CompactPatchNode;
  childrenTruncatedCount?: number;
  optionsTruncatedCount?: number;
  defaultValuesTruncatedCount?: number;
}

export interface PatchContextPayload {
  nodeHints: PatchNodeHint[];
  compactTree: CompactPatchNode[];
}

export type ViewPatchOperation =
  | {
      kind: 'insert-node';
      parentId?: string | null;
      position?: ContinuumViewPatchPosition;
      node: ViewNode;
    }
  | {
      kind: 'move-node';
      nodeId: string;
      parentId?: string | null;
      position?: ContinuumViewPatchPosition;
    }
  | {
      kind: 'wrap-nodes';
      parentId?: string | null;
      nodeIds: string[];
      wrapper: ViewNode;
    }
  | {
      kind: 'replace-node';
      nodeId: string;
      node: ViewNode;
    }
  | {
      kind: 'remove-node';
      nodeId: string;
    }
  | {
      kind: 'append-content';
      nodeId: string;
      text: string;
    };

export interface ViewPatchPlan {
  mode: 'patch' | 'full';
  operations: ViewPatchOperation[];
  reason?: string;
  fullStrategy?: 'evolve' | 'replace';
}
