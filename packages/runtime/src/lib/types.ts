import type {
  ViewNode,
  ViewDefinition,
  NodeValue,
  DataSnapshot,
  ValueLineage,
  DetachedValue,
} from '@continuum-dev/contract';
import type {
  ReconciliationIssue,
  ReconciliationResolution,
  StateDiff,
} from '@continuum-dev/protocol';

export {
  DATA_RESOLUTIONS,
  ISSUE_CODES,
  ISSUE_SEVERITY,
  VIEW_DIFFS,
  type DataResolution,
  type IssueCode,
  type IssueSeverity,
  type ViewDiff,
} from '@continuum-dev/protocol';
export type {
  ReconciliationIssue,
  ReconciliationResolution,
  ReconciliationResult,
  StateDiff,
} from '@continuum-dev/protocol';

/**
 * Runtime behavior flags and extension points for `reconcile`.
 */
export interface ReconciliationOptions {
  /**
   * When true, suppresses node-removed warnings for partial restoration workflows.
   *
   * Useful when your app intentionally allows temporary view pruning while keeping
   * detached values around for later restoration.
   */
  allowPartialRestore?: boolean;
  /**
   * When `priorData` is set but `priorView` is null, if false (default): prior field
   * values are not copied into the new snapshot. If true: best-effort fit—copy prior
   * values only where the scoped node id still exists in the new view; each such copy
   * is flagged (e.g. `UNVALIDATED_CARRY`) because there was no prior view to validate structure.
   */
  allowPriorDataWithoutPriorView?: boolean;
  /**
   * Per-node migration overrides keyed by the new node id.
   *
   * Use this when you know a specific node changed schema and needs custom logic.
   */
  migrationStrategies?: Record<string, MigrationStrategy>;
  /**
   * Named migration functions referenced by view-level migration rules.
   *
   * Use with `newNode.migrations[*].strategyId` to keep migration logic reusable.
   */
  strategyRegistry?: Record<string, MigrationStrategy>;
  /**
   * Time source used for lineage and detached value timestamps.
   *
   * Provide this when fresh reconciliation does not have prior lineage to derive from.
   */
  clock?: () => number;
}

export interface ReconcileInput {
  newView: ViewDefinition;
  priorView: ViewDefinition | null;
  priorData: DataSnapshot | null;
  options: ReconciliationOptions;
}

export interface MigrationStrategyContext {
  nodeId: string;
  priorNode: ViewNode;
  newNode: ViewNode;
  priorValue: unknown;
}

export type MigrationStrategy = (
  context: MigrationStrategyContext
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
