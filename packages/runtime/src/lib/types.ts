import type {
  ComponentDefinition,
  ComponentState,
  DiffType,
  IssueCode,
  IssueSeverity,
  StateSnapshot,
  TraceAction,
  ValueMeta,
  OrphanedValue,
} from '@continuum/contract';

export interface ReconciliationResult {
  reconciledState: StateSnapshot;
  diffs: StateDiff[];
  issues: ReconciliationIssue[];
  trace: ReconciliationTrace[];
}

export interface StateDiff {
  componentId: string;
  type: DiffType;
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string;
}

export interface ReconciliationTrace {
  componentId: string;
  priorId: string | null;
  matchedBy: 'id' | 'key' | null;
  priorType: string | null;
  newType: string;
  action: TraceAction;
  priorValue: unknown;
  reconciledValue: unknown;
}

export interface ReconciliationIssue {
  severity: IssueSeverity;
  componentId?: string;
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
  componentId: string,
  oldSchema: ComponentDefinition,
  newSchema: ComponentDefinition,
  oldState: unknown
) => unknown;

export interface ComponentResolutionAccumulator {
  values: Record<string, ComponentState>;
  valuesMeta: Record<string, ValueMeta>;
  orphanedValues: Record<string, OrphanedValue>;
  restoredOrphanKeys: Set<string>;
  diffs: StateDiff[];
  trace: ReconciliationTrace[];
  issues: ReconciliationIssue[];
}
