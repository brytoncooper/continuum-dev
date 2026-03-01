import type {
  ViewNode,
  NodeValue,
  ViewDiff,
  IssueCode,
  IssueSeverity,
  DataSnapshot,
  DataResolution,
  ValueLineage,
  DetachedValue,
} from '@continuum/contract';

export interface ReconciliationResult {
  reconciledState: DataSnapshot;
  diffs: StateDiff[];
  issues: ReconciliationIssue[];
  resolutions: ReconciliationResolution[];
}

export interface StateDiff {
  nodeId: string;
  type: ViewDiff;
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string;
}

export interface ReconciliationResolution {
  nodeId: string;
  priorId: string | null;
  matchedBy: 'id' | 'key' | null;
  priorType: string | null;
  newType: string;
  resolution: DataResolution;
  priorValue: unknown;
  reconciledValue: unknown;
}

export interface ReconciliationIssue {
  severity: IssueSeverity;
  nodeId?: string;
  message: string;
  code: IssueCode;
}

export interface ReconciliationOptions {
  allowPartialRestore?: boolean;
  allowBlindCarry?: boolean;
  migrationStrategies?: Record<string, MigrationStrategy>;
  strategyRegistry?: Record<string, MigrationStrategy>;
  clock?: () => number;
}

export type MigrationStrategy = (
  nodeId: string,
  priorNode: ViewNode,
  newNode: ViewNode,
  priorValue: unknown
) => unknown;

export interface NodeResolutionAccumulator {
  values: Record<string, NodeValue>;
  valueLineage: Record<string, ValueLineage>;
  detachedValues: Record<string, DetachedValue>;
  restoredDetachedKeys: Set<string>;
  diffs: StateDiff[];
  resolutions: ReconciliationResolution[];
  issues: ReconciliationIssue[];
}
