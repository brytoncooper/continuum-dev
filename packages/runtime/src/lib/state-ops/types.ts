import type {
  DataSnapshot,
  NodeValue,
  ViewDefinition,
  ViewNode,
} from '@continuum-dev/contract';
import type { ContinuumViewStreamPart } from '@continuum-dev/protocol';
import type {
  ReconciliationIssue,
  ReconciliationOptions,
  ReconciliationResolution,
  StateDiff,
} from '../types.js';

export type { ContinuumViewStreamPart } from '@continuum-dev/protocol';

export interface RuntimeNodeLookupEntry {
  canonicalId: string;
  node: ViewNode;
  parentNode: ViewNode | null;
}

export interface ApplyContinuumViewUpdateInput {
  baseView: ViewDefinition | null;
  baseData: DataSnapshot | null;
  nextView: ViewDefinition;
  sessionId: string;
  clock?: () => number;
  reconciliationOptions?: Omit<ReconciliationOptions, 'clock'>;
  affectedNodeIds?: string[];
  incrementalHint?: 'presentation-content';
  priorIssues?: ReconciliationIssue[];
  priorDiffs?: StateDiff[];
  priorResolutions?: ReconciliationResolution[];
}

export interface AppliedContinuumViewState {
  priorView: ViewDefinition | null;
  view: ViewDefinition;
  data: DataSnapshot;
  issues: ReconciliationIssue[];
  diffs: StateDiff[];
  resolutions: ReconciliationResolution[];
  strategy: 'full' | 'incremental';
}

export interface ClassifyContinuumValueIngressInput {
  view: ViewDefinition | null;
  data: DataSnapshot | null;
  nodeId: string;
}

export type ContinuumValueIngressDecision =
  | {
      kind: 'unknown-node';
      nodeId: string;
      issues: ReconciliationIssue[];
    }
  | {
      kind: 'proposal';
      canonicalId: string;
      node: ViewNode;
      currentValue: NodeValue | undefined;
    }
  | {
      kind: 'apply';
      canonicalId: string;
      node: ViewNode;
      currentValue: NodeValue | undefined;
    };

export interface ApplyContinuumNodeValueInput {
  view: ViewDefinition | null;
  data: DataSnapshot | null;
  nodeId: string;
  value: NodeValue;
  sessionId: string;
  timestamp: number;
  interactionId?: string;
  validate?: boolean;
}

export type ApplyContinuumNodeValueResult =
  | {
      kind: 'unknown-node';
      nodeId: string;
      data: DataSnapshot | null;
      issues: ReconciliationIssue[];
    }
  | {
      kind: 'applied';
      canonicalId: string;
      node: ViewNode;
      data: DataSnapshot;
      issues: ReconciliationIssue[];
    };

export interface ApplyContinuumViewportStateInput {
  view: ViewDefinition | null;
  data: DataSnapshot | null;
  nodeId: string;
  state: NonNullable<DataSnapshot['viewContext']>[string];
  sessionId: string;
  timestamp: number;
}

export type ApplyContinuumViewportStateResult =
  | {
      kind: 'unknown-node';
      nodeId: string;
      data: DataSnapshot | null;
      issues: ReconciliationIssue[];
    }
  | {
      kind: 'applied';
      canonicalId: string;
      node: ViewNode;
      data: DataSnapshot;
      issues: ReconciliationIssue[];
    };

export interface ApplyContinuumViewStreamPartInput {
  currentView: ViewDefinition;
  part: Exclude<ContinuumViewStreamPart, { kind: 'view' }>;
}

export interface ApplyContinuumViewStreamPartResult {
  view: ViewDefinition;
  affectedNodeIds: string[];
  incrementalHint?: 'presentation-content';
}
