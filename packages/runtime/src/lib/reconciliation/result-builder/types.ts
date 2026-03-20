import type {
  DataSnapshot,
  DetachedValue,
  ViewDefinition,
  ViewNode,
} from '@continuum-dev/contract';
import type {
  NodeResolutionAccumulator,
  ReconciliationIssue,
  ReconciliationOptions,
  ReconciliationResolution,
  StateDiff,
} from '../../types.js';

export interface RemovedNodesResult {
  diffs: StateDiff[];
  issues: ReconciliationIssue[];
  detachedValues?: Record<string, DetachedValue>;
}

export interface AssembleReconciliationResultInput {
  resolved: NodeResolutionAccumulator;
  removals: RemovedNodesResult;
  priorData: DataSnapshot;
  newView: ViewDefinition;
  now: number;
}

export interface PriorDataWithoutViewInput {
  newView: ViewDefinition;
  priorData: DataSnapshot;
  now: number;
  options: ReconciliationOptions;
}

export interface InitialSnapshotFromViewInput {
  newView: ViewDefinition;
  now: number;
}

export interface FreshNodeCollectionInput {
  nodes: ViewNode[];
  values: DataSnapshot['values'];
  diffs: StateDiff[];
  resolutions: ReconciliationResolution[];
}

export interface LineageBaseInput {
  priorLineage: DataSnapshot['lineage'];
  now: number;
  newView: ViewDefinition;
}

export interface LineageWithHashInput extends LineageBaseInput {
  viewHash?: string;
}

export interface FreshLineageInput {
  now: number;
  newView: ViewDefinition;
  sessionId: string;
}
