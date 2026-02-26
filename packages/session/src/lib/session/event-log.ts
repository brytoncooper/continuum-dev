import type {
  Interaction,
  ComponentState,
  ValueMeta,
} from '@continuum/contract';
import type { SessionState } from './session-state.js';
import { generateId } from './session-state.js';
import { buildSnapshotFromCurrentState, notifySnapshotListeners } from './listeners.js';
import { cloneCheckpointSnapshot } from './checkpoint-manager.js';

export function recordIntent(
  internal: SessionState,
  partial: Omit<Interaction, 'id' | 'timestamp' | 'sessionId' | 'schemaVersion'>
): void {
  if (internal.destroyed || !internal.currentState || !internal.currentSchema) return;

  const now = internal.clock();
  const id = generateId('int', internal.clock);

  const interaction: Interaction = {
    id,
    sessionId: internal.sessionId,
    schemaVersion: internal.currentSchema.version,
    timestamp: now,
    componentId: partial.componentId,
    type: partial.type,
    payload: partial.payload,
  };

  internal.eventLog.push(interaction);
  if (internal.eventLog.length > internal.maxEventLogSize) {
    internal.eventLog.splice(0, internal.eventLog.length - internal.maxEventLogSize);
  }

  internal.currentState = {
    ...internal.currentState,
    values: {
      ...internal.currentState.values,
      [partial.componentId]: partial.payload as ComponentState,
    },
    meta: {
      ...internal.currentState.meta,
      timestamp: now,
      lastInteractionId: id,
    },
    valuesMeta: {
      ...internal.currentState.valuesMeta,
      [partial.componentId]: {
        lastUpdated: now,
        lastInteractionId: id,
      } as ValueMeta,
    },
  };

  const lastAutoCheckpoint = [...internal.checkpoints]
    .reverse()
    .find((checkpoint) => internal.autoCheckpointIds.has(checkpoint.id));
  if (lastAutoCheckpoint) {
    const snapshot = buildSnapshotFromCurrentState(internal);
    if (snapshot) {
      lastAutoCheckpoint.snapshot = cloneCheckpointSnapshot(snapshot);
    }
  }

  notifySnapshotListeners(internal);
}
