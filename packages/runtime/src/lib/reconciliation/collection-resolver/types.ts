import type {
  CollectionNode,
  CollectionNodeState,
  NodeValue,
  ViewNode,
} from '@continuum-dev/contract';
import type {
  ReconciliationOptions,
  ReconciliationIssue,
} from '../../types.js';

export interface CollectionResolutionResult {
  value: NodeValue<CollectionNodeState>;
  issues: ReconciliationIssue[];
  didMigrateItems: boolean;
}

export interface CollectionReconcileInput {
  priorNode: CollectionNode;
  newNode: CollectionNode;
  priorValue: unknown;
  options: ReconciliationOptions;
}

export interface ApplyItemConstraintsInput {
  items: Array<{ values: Record<string, NodeValue> }>;
  minItems: number | undefined;
  maxItems: number | undefined;
  issues: ReconciliationIssue[];
  nodeId: string;
  template: ViewNode;
}

export interface ResolveUpdatedDefaultsInput {
  newNode: CollectionNode;
  normalizedValue: NodeValue<CollectionNodeState>;
  issues: ReconciliationIssue[];
  priorValue: unknown;
}
