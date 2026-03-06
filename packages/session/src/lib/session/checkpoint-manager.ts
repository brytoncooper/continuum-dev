import type { Checkpoint } from '@continuum/contract';
import type { SessionState } from './session-state.js';
import { generateId } from './session-state.js';
import {
  buildSnapshotFromCurrentState,
  notifySnapshotAndIssueListeners,
} from './listeners.js';

/**
 * Deep clones checkpoint payloads to prevent accidental shared mutations.
 *
 * @param value Snapshot value to clone.
 * @returns Structured cloned value.
 */
export function cloneCheckpointSnapshot<T>(value: T): T {
  return structuredClone(value);
}

/**
 * Creates an automatic checkpoint from current snapshot state.
 *
 * Auto checkpoints are pruned first when exceeding `maxCheckpoints`.
 *
 * @param internal Mutable internal session state.
 */
export function autoCheckpoint(internal: SessionState): void {
  const snapshot = buildSnapshotFromCurrentState(internal);
  if (!snapshot) return;
  const id = generateId('cp', internal.clock);

  internal.checkpoints.push({
    checkpointId: id,
    sessionId: internal.sessionId,
    snapshot: cloneCheckpointSnapshot(snapshot),
    eventIndex: internal.eventLog.length,
    timestamp: internal.clock(),
    trigger: 'auto',
  });
  if (internal.checkpoints.length > internal.maxCheckpoints) {
    const overflow = internal.checkpoints.length - internal.maxCheckpoints;
    for (let index = 0; index < overflow; index += 1) {
      const removableIndex = internal.checkpoints.findIndex((checkpoint) => checkpoint.trigger === 'auto');
      if (removableIndex === -1) break;
      internal.checkpoints.splice(removableIndex, 1);
    }
  }
}

/**
 * Creates a manual checkpoint and appends it to the checkpoint stack.
 *
 * @param internal Mutable internal session state.
 * @returns The created checkpoint.
 */
export function createManualCheckpoint(internal: SessionState): Checkpoint {
  const snapshot = buildSnapshotFromCurrentState(internal);
  if (!snapshot) {
    throw new Error('Cannot create checkpoint before pushing a view');
  }
  const checkpoint = {
    checkpointId: generateId('cp', internal.clock),
    sessionId: internal.sessionId,
    snapshot: cloneCheckpointSnapshot(snapshot),
    eventIndex: internal.eventLog.length,
    timestamp: internal.clock(),
    trigger: 'manual' as const,
  };
  internal.checkpoints.push(checkpoint);
  if (internal.checkpoints.length > internal.maxCheckpoints) {
    const overflow = internal.checkpoints.length - internal.maxCheckpoints;
    for (let index = 0; index < overflow; index += 1) {
      const removableIndex = internal.checkpoints.findIndex((cp) => cp.trigger === 'manual');
      if (removableIndex === -1) {
        break;
      }
      internal.checkpoints.splice(removableIndex, 1);
    }
  }
  return checkpoint;
}

/**
 * Restores state from a checkpoint without truncating checkpoint history.
 *
 * @param internal Mutable internal session state.
 * @param cp Checkpoint to restore from.
 */
export function restoreFromCheckpoint(internal: SessionState, cp: Checkpoint): void {
  if (internal.destroyed) return;

  internal.currentView = cloneCheckpointSnapshot(cp.snapshot.view);
  internal.currentData = cloneCheckpointSnapshot(cp.snapshot.data);
  internal.priorView = null;
  internal.eventLog = internal.eventLog.slice(0, cp.eventIndex);
  internal.issues = [];
  internal.diffs = [];
  internal.resolutions = [];
  internal.pendingIntents = [];

  notifySnapshotAndIssueListeners(internal);
}

/**
 * Rewinds state to a checkpoint id and truncates checkpoints after it.
 *
 * @param internal Mutable internal session state.
 * @param checkpointId Target checkpoint id.
 */
export function rewind(internal: SessionState, checkpointId: string): void {
  if (internal.destroyed) return;
  const idx = internal.checkpoints.findIndex((cp) => cp.checkpointId === checkpointId);
  if (idx === -1) throw new Error(`Checkpoint ${checkpointId} not found`);

  const cp = internal.checkpoints[idx];
  internal.checkpoints = internal.checkpoints.slice(0, idx + 1);

  internal.currentView = cloneCheckpointSnapshot(cp.snapshot.view);
  internal.currentData = cloneCheckpointSnapshot(cp.snapshot.data);
  internal.priorView = null;
  internal.eventLog = internal.eventLog.slice(0, cp.eventIndex);
  internal.issues = [];
  internal.diffs = [];
  internal.resolutions = [];
  internal.pendingIntents = [];

  notifySnapshotAndIssueListeners(internal);
}
