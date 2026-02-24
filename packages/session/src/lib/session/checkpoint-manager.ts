import type { Checkpoint } from '@continuum/contract';
import type { SessionState } from './session-state.js';
import { generateId } from './session-state.js';
import { getSnapshotFromState, notifyAllListeners } from './listeners.js';

export function autoCheckpoint(internal: SessionState): void {
  const snapshot = getSnapshotFromState(internal);
  if (!snapshot) return;

  internal.checkpoints.push({
    id: generateId('cp', internal.clock),
    sessionId: internal.sessionId,
    snapshot: JSON.parse(JSON.stringify(snapshot)),
    eventIndex: internal.eventLog.length,
    timestamp: internal.clock(),
  });
}

export function createManualCheckpoint(internal: SessionState): Checkpoint {
  const snapshot = getSnapshotFromState(internal)!;
  return {
    id: generateId('cp', internal.clock),
    sessionId: internal.sessionId,
    snapshot: JSON.parse(JSON.stringify(snapshot)),
    eventIndex: internal.eventLog.length,
    timestamp: internal.clock(),
  };
}

export function restoreFromCheckpoint(internal: SessionState, cp: Checkpoint): void {
  if (internal.destroyed) return;

  internal.currentSchema = cp.snapshot.schema;
  internal.currentState = cp.snapshot.state;
  internal.priorSchema = null;
  internal.eventLog = internal.eventLog.slice(0, cp.eventIndex);
  internal.issues = [];
  internal.diffs = [];
  internal.trace = [];
  internal.pendingActions = [];

  notifyAllListeners(internal);
}

export function rewind(internal: SessionState, checkpointId: string): void {
  const idx = internal.checkpoints.findIndex((cp) => cp.id === checkpointId);
  if (idx === -1) throw new Error(`Checkpoint ${checkpointId} not found`);

  const cp = internal.checkpoints[idx];
  internal.checkpoints = internal.checkpoints.slice(0, idx + 1);

  internal.currentSchema = JSON.parse(JSON.stringify(cp.snapshot.schema));
  internal.currentState = JSON.parse(JSON.stringify(cp.snapshot.state));
  internal.priorSchema = null;
  internal.eventLog = internal.eventLog.slice(0, cp.eventIndex);
  internal.issues = [];
  internal.diffs = [];
  internal.trace = [];
  internal.pendingActions = [];

  notifyAllListeners(internal);
}
