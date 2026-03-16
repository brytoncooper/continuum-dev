import type {
  NodeValue,
} from '@continuum-dev/contract';
import { isInteractionType, type Interaction } from '@continuum-dev/protocol';
import type { SessionState } from '../state/index.js';
import { generateId } from '../state/index.js';
import {
  buildCommittedSnapshotFromCurrentState,
  notifySnapshotAndIssueListeners,
} from '../listeners/index.js';
import { cloneCheckpointSnapshot } from '../state/index.js';
import { applyContinuumNodeValueUpdate } from '@continuum-dev/runtime';
import {
  applyRenderOnlyValueUpdateIfPossible,
  syncCommittedValueToStreams,
} from '../streams/index.js';

function dedupeIssues(
  existing: SessionState['issues'],
  incoming: SessionState['issues']
): SessionState['issues'] {
  if (incoming.length === 0) {
    return existing;
  }
  const nextKeys = new Set(
    incoming.map((issue) => `${issue.nodeId ?? ''}:${issue.code}`)
  );
  return [
    ...existing.filter(
      (issue) => !nextKeys.has(`${issue.nodeId ?? ''}:${issue.code}`)
    ),
    ...incoming,
  ];
}

/**
 * Records an interaction event and applies its payload to current data state.
 *
 * The function updates event log, value lineage, optional validation issues,
 * and latest auto-checkpoint snapshot.
 *
 * @param internal Mutable internal session state.
 * @param partial Interaction payload without generated metadata.
 */
export function recordIntent(
  internal: SessionState,
  partial: Omit<
    Interaction,
    'interactionId' | 'timestamp' | 'sessionId' | 'viewVersion'
  >
): void {
  if (internal.destroyed) return;
  if (!isInteractionType(partial.type)) {
    throw new Error(`Invalid interaction type: ${String(partial.type)}`);
  }

  if (
    partial.type === 'data-update' &&
    applyRenderOnlyValueUpdateIfPossible(
      internal,
      partial.nodeId,
      partial.payload as NodeValue
    )
  ) {
    return;
  }

  if (!internal.currentData || !internal.currentView) {
    return;
  }

  const now = internal.clock();
  const id = generateId('int', internal.clock);

  const interaction: Interaction = {
    interactionId: id,
    sessionId: internal.sessionId,
    viewVersion: internal.currentView.version,
    timestamp: now,
    nodeId: partial.nodeId,
    type: partial.type,
    payload: partial.payload,
  };

  internal.eventLog.push(interaction);
  if (internal.eventLog.length > internal.maxEventLogSize) {
    internal.eventLog.splice(
      0,
      internal.eventLog.length - internal.maxEventLogSize
    );
  }

  const payload = { ...(partial.payload as NodeValue) };
  const updateResult = applyContinuumNodeValueUpdate({
    view: internal.currentView,
    data: internal.currentData,
    nodeId: partial.nodeId,
    value: payload,
    sessionId: internal.sessionId,
    timestamp: now,
    interactionId: id,
    validate: internal.validateOnUpdate,
  });

  if (updateResult.kind === 'unknown-node') {
    internal.issues = dedupeIssues(internal.issues, updateResult.issues);
    notifySnapshotAndIssueListeners(internal);
    return;
  }

  const canonicalId = updateResult.canonicalId;
  internal.currentData = updateResult.data;
  syncCommittedValueToStreams(internal, canonicalId, payload);
  if (updateResult.issues.length > 0) {
    internal.issues = dedupeIssues(internal.issues, updateResult.issues);
  }

  const lastAutoCheckpoint = [...internal.checkpoints]
    .reverse()
    .find((checkpoint) => checkpoint.trigger === 'auto');
  if (lastAutoCheckpoint) {
    const snapshot = buildCommittedSnapshotFromCurrentState(internal);
    if (snapshot) {
      lastAutoCheckpoint.snapshot = cloneCheckpointSnapshot(snapshot);
    }
  }

  notifySnapshotAndIssueListeners(internal);
}
