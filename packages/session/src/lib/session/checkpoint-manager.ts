import type { Checkpoint } from '@continuum/contract';
import type { SessionState } from './session-state.js';
import { generateId } from './session-state.js';
import {
  buildSnapshotFromCurrentState,
  notifySnapshotAndIssueListeners,
} from './listeners.js';

export function cloneCheckpointSnapshot<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function autoCheckpoint(internal: SessionState): void {
  const snapshot = buildSnapshotFromCurrentState(internal);
  if (!snapshot) return;
  const id = generateId('cp', internal.clock);

  internal.checkpoints.push({
    id,
    sessionId: internal.sessionId,
    snapshot: cloneCheckpointSnapshot(snapshot),
    eventIndex: internal.eventLog.length,
    timestamp: internal.clock(),
  });
  internal.autoCheckpointIds.add(id);
}

export function createManualCheckpoint(internal: SessionState): Checkpoint {
  const snapshot = buildSnapshotFromCurrentState(internal);
  if (!snapshot) {
    throw new Error('Cannot create checkpoint before pushing a schema');
  }
  const checkpoint = {
    id: generateId('cp', internal.clock),
    sessionId: internal.sessionId,
    snapshot: cloneCheckpointSnapshot(snapshot),
    eventIndex: internal.eventLog.length,
    timestamp: internal.clock(),
  };
  internal.checkpoints.push(checkpoint);
  return checkpoint;
}

export function restoreFromCheckpoint(internal: SessionState, cp: Checkpoint): void {
  if (internal.destroyed) return;

  internal.currentSchema = cloneCheckpointSnapshot(cp.snapshot.schema);
  internal.currentState = cloneCheckpointSnapshot(cp.snapshot.state);
  internal.priorSchema = null;
  internal.eventLog = internal.eventLog.slice(0, cp.eventIndex);
  internal.issues = [];
  internal.diffs = [];
  internal.trace = [];
  internal.pendingActions = [];

  notifySnapshotAndIssueListeners(internal);
}

export function rewind(internal: SessionState, checkpointId: string): void {
  if (internal.destroyed) return;
  const idx = internal.checkpoints.findIndex((cp) => cp.id === checkpointId);
  if (idx === -1) throw new Error(`Checkpoint ${checkpointId} not found`);

  const cp = internal.checkpoints[idx];
  internal.checkpoints = internal.checkpoints.slice(0, idx + 1);
  internal.autoCheckpointIds = new Set(
    internal.checkpoints
      .map((checkpoint) => checkpoint.id)
      .filter((id) => internal.autoCheckpointIds.has(id))
  );

  internal.currentSchema = cloneCheckpointSnapshot(cp.snapshot.schema);
  internal.currentState = cloneCheckpointSnapshot(cp.snapshot.state);
  internal.priorSchema = null;
  internal.eventLog = internal.eventLog.slice(0, cp.eventIndex);
  internal.issues = [];
  internal.diffs = [];
  internal.trace = [];
  internal.pendingActions = [];

  notifySnapshotAndIssueListeners(internal);
}
