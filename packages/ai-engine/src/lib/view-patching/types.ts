import type { ContinuumViewStructuralStreamPart } from '@continuum-dev/protocol';

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

export type ViewPatchOperation = ContinuumViewStructuralStreamPart;

export interface ViewPatchPlan {
  operations: ViewPatchOperation[];
  reason?: string;
}
