import type { ContinuitySnapshot } from '@continuum-dev/contract';
import { sanitizeContinuumDataSnapshot } from '@continuum-dev/runtime/canonical-snapshot';
import type { ReconciliationIssue } from '@continuum-dev/runtime';
import type { SessionState } from '../state/index.js';
import {
  getActiveForegroundStream,
  toPublicSessionStream,
} from '../streams/state.js';

function freezeSnapshot(
  view: ContinuitySnapshot['view'],
  data: ContinuitySnapshot['data']
): ContinuitySnapshot {
  const snapshot: ContinuitySnapshot = {
    view: { ...view },
    data: sanitizeContinuumDataSnapshot({ ...data })!,
  };
  Object.freeze(snapshot.view);
  Object.freeze(snapshot.data);
  return Object.freeze(snapshot);
}

/**
 * Builds the durable committed continuity snapshot from internal view/data state.
 *
 * @param internal Mutable internal session state.
 * @returns Snapshot when both view and data are present, otherwise null.
 */
export function buildCommittedSnapshotFromCurrentState(
  internal: SessionState
): ContinuitySnapshot | null {
  if (!internal.currentView || !internal.currentData) return null;
  return freezeSnapshot(internal.currentView, internal.currentData);
}

/**
 * Builds the current renderable continuity snapshot, including a foreground stream when present.
 *
 * @param internal Mutable internal session state.
 * @returns Snapshot when a committed or foreground stream snapshot exists, otherwise null.
 */
export function buildRenderSnapshotFromCurrentState(
  internal: SessionState
): ContinuitySnapshot | null {
  const activeStream = getActiveForegroundStream(internal);
  if (activeStream?.workingView && activeStream.workingData) {
    return freezeSnapshot(activeStream.workingView, activeStream.workingData);
  }

  return buildCommittedSnapshotFromCurrentState(internal);
}

/**
 * Backward-compatible alias for the current renderable snapshot.
 *
 * @param internal Mutable internal session state.
 * @returns Render snapshot when present, otherwise null.
 */
export function buildSnapshotFromCurrentState(
  internal: SessionState
): ContinuitySnapshot | null {
  return buildRenderSnapshotFromCurrentState(internal);
}

/**
 * Notifies all snapshot listeners with the latest snapshot value.
 *
 * Listener exceptions are swallowed so one faulty subscriber cannot block others.
 *
 * @param internal Mutable internal session state.
 */
export function notifySnapshotListeners(internal: SessionState): void {
  const snapshot = buildRenderSnapshotFromCurrentState(internal);
  for (const listener of internal.snapshotListeners) {
    try {
      (listener as (s: ContinuitySnapshot | null) => void)(snapshot);
    } catch {
      continue;
    }
  }
}

/**
 * Notifies all issue listeners with a cloned issue array.
 *
 * Listener exceptions are swallowed so one faulty subscriber cannot block others.
 *
 * @param internal Mutable internal session state.
 */
export function notifyIssueListeners(internal: SessionState): void {
  const activeStream = getActiveForegroundStream(internal);
  const issues = activeStream ? activeStream.issues : internal.issues;
  for (const listener of internal.issueListeners) {
    try {
      listener([...issues]);
    } catch {
      continue;
    }
  }
}

/**
 * Notifies snapshot listeners, then issue listeners.
 *
 * @param internal Mutable internal session state.
 */
export function notifySnapshotAndIssueListeners(internal: SessionState): void {
  notifySnapshotListeners(internal);
  notifyIssueListeners(internal);
}

/**
 * Notifies all stream listeners with the latest stream metadata.
 *
 * @param internal Mutable internal session state.
 */
export function notifyStreamListeners(internal: SessionState): void {
  const streams = [...internal.streams.values()].map(toPublicSessionStream);
  for (const listener of internal.streamListeners) {
    try {
      listener(streams);
    } catch {
      continue;
    }
  }
}

/**
 * Registers a snapshot listener.
 *
 * @param internal Mutable internal session state.
 * @param listener Snapshot callback.
 * @returns Unsubscribe function.
 */
export function subscribeSnapshot(
  internal: SessionState,
  listener: (snapshot: ContinuitySnapshot | null) => void
): () => void {
  internal.snapshotListeners.add(listener);
  return () => {
    internal.snapshotListeners.delete(listener);
  };
}

export function notifyFocusListeners(internal: SessionState): void {
  const id = internal.focusedNodeId;
  for (const listener of [...internal.focusListeners]) {
    try {
      listener(id);
    } catch {
      continue;
    }
  }
}

export function subscribeFocus(
  internal: SessionState,
  listener: (focusedNodeId: string | null) => void
): () => void {
  internal.focusListeners.add(listener);
  return () => {
    internal.focusListeners.delete(listener);
  };
}

/**
 * Registers a stream listener.
 *
 * @param internal Mutable internal session state.
 * @param listener Streams callback.
 * @returns Unsubscribe function.
 */
export function subscribeStreams(
  internal: SessionState,
  listener: (streams: ReturnType<typeof toPublicSessionStream>[]) => void
): () => void {
  internal.streamListeners.add(listener);
  return () => {
    internal.streamListeners.delete(listener);
  };
}

/**
 * Registers an issue listener.
 *
 * @param internal Mutable internal session state.
 * @param listener Issues callback.
 * @returns Unsubscribe function.
 */
export function subscribeIssues(
  internal: SessionState,
  listener: (issues: ReconciliationIssue[]) => void
): () => void {
  internal.issueListeners.add(listener);
  return () => {
    internal.issueListeners.delete(listener);
  };
}
