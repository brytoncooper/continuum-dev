import type { ComponentDefinition, ComponentState, StateSnapshot, ValueMeta } from '@continuum/contract';

export interface ReconciliationResult {
  reconciledState: StateSnapshot;
  diffs: StateDiff[];
  issues: ReconciliationIssue[];
  trace: ReconciliationTrace[];
}

export interface StateDiff {
  componentId: string;
  type: 'added' | 'removed' | 'modified' | 'migrated' | 'type-changed';
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
  action: 'carried' | 'migrated' | 'dropped' | 'added';
  priorValue: unknown;
  reconciledValue: unknown;
}

export interface ReconciliationIssue {
  severity: 'error' | 'warning' | 'info';
  componentId?: string;
  message: string;
  code: string;
}

export interface ReconciliationOptions {
  strictMode?: boolean;
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
) => unknown | null;

export interface ComponentResolutionAccumulator {
  values: Record<string, ComponentState>;
  valuesMeta: Record<string, ValueMeta>;
  diffs: StateDiff[];
  trace: ReconciliationTrace[];
  issues: ReconciliationIssue[];
}
