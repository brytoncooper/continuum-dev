import type { SchemaSnapshot } from '@continuum/contract';
import { reconcile } from '@continuum/runtime';
import type { SessionState } from './session-state.js';
import { autoCheckpoint } from './checkpoint-manager.js';
import { markAllPendingActionsAsStale } from './action-manager.js';
import { notifySnapshotAndIssueListeners } from './listeners.js';

export function pushSchema(internal: SessionState, schema: SchemaSnapshot): void {
  if (internal.destroyed) return;

  const priorVersion = internal.currentSchema?.version;
  internal.priorSchema = internal.currentSchema;
  internal.currentSchema = schema;

  const result = reconcile(
    schema,
    internal.priorSchema,
    internal.currentState,
    { clock: internal.clock }
  );

  internal.currentState = {
    ...result.reconciledState,
    meta: {
      ...result.reconciledState.meta,
      sessionId: internal.sessionId,
    },
  };
  internal.issues = result.issues;
  internal.diffs = result.diffs;
  internal.trace = result.trace;

  if (priorVersion && priorVersion !== schema.version) {
    markAllPendingActionsAsStale(internal);
  }

  autoCheckpoint(internal);
  notifySnapshotAndIssueListeners(internal);
}
