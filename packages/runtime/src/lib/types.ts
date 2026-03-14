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
} from '@continuum-dev/contract';

export interface ReconciliationResult {
  /**
   * The merged snapshot to persist and render after reconciliation.
   */
  reconciledState: DataSnapshot;
  /**
   * Change events describing what happened to each affected node value.
   */
  diffs: StateDiff[];
  /**
   * Validation and reconciliation warnings/errors emitted during processing.
   */
  issues: ReconciliationIssue[];
  /**
   * Per-node explanation of how each value was resolved.
   */
  resolutions: ReconciliationResolution[];
}

export interface StateDiff {
  /**
   * Node id in the reconciled view.
   */
  nodeId: string;
  /**
   * Diff category such as added, removed, migrated, type-changed, or restored.
   */
  type: ViewDiff;
  /**
   * Previous value from the prior snapshot (when available).
   */
  oldValue?: unknown;
  /**
   * New value produced by reconciliation (when available).
   */
  newValue?: unknown;
  /**
   * Optional machine-readable rationale for the diff.
   */
  reason?: string;
}

export interface ReconciliationResolution {
  /**
   * Node id in the new view this resolution applies to.
   */
  nodeId: string;
  /**
   * Matched node id from the prior view, if any.
   */
  priorId: string | null;
  /**
   * How the prior node was matched to the new node.
   */
  matchedBy: 'id' | 'semanticKey' | 'key' | null;
  /**
   * Prior node type, if a prior node was found.
   */
  priorType: string | null;
  /**
   * New node type in the current view.
   */
  newType: string;
  /**
   * Final resolution outcome for this node.
   */
  resolution: DataResolution;
  /**
   * Value observed in prior state before reconciliation.
   */
  priorValue: unknown;
  /**
   * Value emitted for this node after reconciliation.
   */
  reconciledValue: unknown;
}

export interface ReconciliationIssue {
  /**
   * Severity level to help route handling (error, warning, info).
   */
  severity: IssueSeverity;
  /**
   * Optional node id associated with the issue.
   */
  nodeId?: string;
  /**
   * Human-readable issue message for logs or UI.
   */
  message: string;
  /**
   * Stable issue code for programmatic handling.
   */
  code: IssueCode;
}

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
   * When true and `priorView` is null, carries values by matching raw node ids.
   *
   * This is a fallback mode for sessions that have data but no previous view AST.
   */
  allowBlindCarry?: boolean;
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

/**
 * User-provided transformation function used when a node schema changes.
 *
 * A strategy should return the value shape expected by the new node. The runtime
 * passes raw prior value payloads so strategies can handle both simple and nested
 * structures. Throwing from this function reports a migration failure issue.
 *
 * @param nodeId Node id in the new view being reconciled.
 * @param priorNode Prior view node definition.
 * @param newNode New view node definition.
 * @param priorValue Previous value payload associated with the node.
 * @returns Reconciled value payload for the new node.
 */
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
