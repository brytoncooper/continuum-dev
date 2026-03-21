export { reconcile } from './lib/reconcile/index.js';
export { applyContinuumViewUpdate } from './lib/runtime-boundaries/view-updates.js';
export {
  applyContinuumNodeValueWrite,
  decideContinuumNodeValueWrite,
} from './lib/runtime-boundaries/direct-updates.js';
export {
  DATA_RESOLUTIONS,
  ISSUE_CODES,
  ISSUE_SEVERITY,
  VIEW_DIFFS,
} from './lib/types.js';
export type {
  DataResolution,
  IssueCode,
  IssueSeverity,
  ViewDiff,
  ReconciliationIssue,
  ReconciliationOptions,
  ReconciliationResolution,
  ReconciliationResult,
  ReconcileInput,
  StateDiff,
  MigrationStrategy,
  MigrationStrategyContext,
} from './lib/types.js';
export type {
  ApplyContinuumViewUpdateInput,
  AppliedContinuumViewState,
  ApplyContinuumNodeValueWriteInput,
  ApplyContinuumNodeValueWriteResult,
  ContinuumNodeValueWriteDecision,
  DecideContinuumNodeValueWriteInput,
} from './lib/runtime-boundaries/types.js';
