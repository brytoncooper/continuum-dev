import type {
  DataSnapshot,
  NodeValue,
  ViewDefinition,
  ViewNode,
} from '@continuum-dev/contract';
import type { ContinuumViewStreamPart } from '@continuum-dev/protocol';
import type { ContinuumTransformPlan } from '@continuum-dev/protocol';
import type {
  ReconciliationIssue,
  ReconciliationOptions,
  ReconciliationResolution,
  StateDiff,
} from '../types.js';

export type { ContinuumViewStreamPart } from '@continuum-dev/protocol';

/**
 * Resolved node context used by lookup-driven runtime helpers.
 */
export interface RuntimeNodeLookupEntry {
  canonicalId: string;
  node: ViewNode;
  parentNode: ViewNode | null;
}

/**
 * Inputs for applying a structural view update through the runtime boundary.
 */
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
  transformPlan?: ContinuumTransformPlan;
}

/**
 * Result of a structural view update after reconcile and optional transforms.
 */
export interface AppliedContinuumViewState {
  priorView: ViewDefinition | null;
  view: ViewDefinition;
  data: DataSnapshot;
  issues: ReconciliationIssue[];
  diffs: StateDiff[];
  resolutions: ReconciliationResolution[];
  strategy: 'full' | 'incremental';
}

/**
 * Inputs for deciding whether a non-user value write should apply directly or become a proposal.
 */
export interface DecideContinuumNodeValueWriteInput {
  view: ViewDefinition | null;
  data: DataSnapshot | null;
  nodeId: string;
}

/**
 * Decision returned by the runtime before a non-user value write is applied.
 */
export type ContinuumNodeValueWriteDecision =
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

/**
 * Inputs for applying a single node value write to canonical snapshot data.
 */
export interface ApplyContinuumNodeValueWriteInput {
  view: ViewDefinition | null;
  data: DataSnapshot | null;
  nodeId: string;
  value: NodeValue;
  sessionId: string;
  timestamp: number;
  interactionId?: string;
  validate?: boolean;
}

/**
 * Result of applying a node value write.
 */
export type ApplyContinuumNodeValueWriteResult =
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

/**
 * Inputs for applying one streamed structural part to the current view.
 */
export interface ApplyContinuumViewStreamPartInput {
  currentView: ViewDefinition;
  part: Exclude<ContinuumViewStreamPart, { kind: 'view' }>;
}

/**
 * Result of applying one streamed structural part.
 */
export interface ApplyContinuumViewStreamPartResult {
  view: ViewDefinition;
  affectedNodeIds: string[];
  incrementalHint?: 'presentation-content';
}
