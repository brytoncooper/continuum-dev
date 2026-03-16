import type { DataSnapshot } from '@continuum-dev/contract';
import type {
  DataResolution,
  IssueCode,
  IssueSeverity,
  ViewDiff,
} from './constants.js';

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
