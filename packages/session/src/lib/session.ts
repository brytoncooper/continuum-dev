import { INTERACTION_TYPES } from '@continuum-dev/contract';
import type {
  ViewportState,
  DetachedValue,
  NodeValue,
  ActionRegistration,
  ActionHandler,
  ActionResult,
  ActionSessionRef,
} from '@continuum-dev/contract';
import {
  applyContinuumViewportStateUpdate,
  classifyContinuumValueIngress,
  resolveNodeLookupEntry,
} from '@continuum-dev/runtime';
import type { Session, SessionOptions, SessionFactory } from './types.js';
import {
  createEmptySessionState,
  generateId,
  resetSessionState,
} from './session/session-state.js';
import type { SessionState } from './session/session-state.js';
import {
  buildCommittedSnapshotFromCurrentState,
  buildRenderSnapshotFromCurrentState,
  notifySnapshotAndIssueListeners,
  notifySnapshotListeners,
  notifyStreamListeners,
  subscribeSnapshot,
  subscribeStreams,
  subscribeIssues,
} from './session/listeners.js';
import {
  cloneCheckpointSnapshot,
  createManualCheckpoint,
  restoreFromCheckpoint,
  rewind,
} from './session/checkpoint-manager.js';
import {
  submitIntent,
  validateIntent,
  cancelIntent,
} from './session/intent-manager.js';
import { recordIntent } from './session/event-log.js';
import { pushView } from './session/view-pusher.js';
import { serializeSession, deserializeToState } from './session/serializer.js';
import { teardownSessionAndClearState } from './session/destroyer.js';
import { attachPersistence } from './session/persistence.js';
import {
  abortStream,
  applyRenderOnlyViewportUpdateIfPossible,
  applyStreamPart,
  beginStream,
  commitStream,
  getPublicStreams,
  syncCommittedViewportToStreams,
} from './session/streams/index.js';

const DEFAULT_STORAGE_KEY = 'continuum_session';
const SESSION_DESTROYED_ERROR = 'Session has been destroyed';

function assertNotDestroyed(internal: SessionState): void {
  if (internal.destroyed) {
    throw new Error(SESSION_DESTROYED_ERROR);
  }
}

function applyViewportStateUpdate(
  internal: SessionState,
  nodeId: string,
  state: ViewportState
): void {
  const applied = applyContinuumViewportStateUpdate({
    view: internal.currentView,
    data: internal.currentData,
    nodeId,
    state,
    sessionId: internal.sessionId,
    timestamp: internal.clock(),
  });

  if (applied.kind === 'unknown-node') {
    applyRenderOnlyViewportUpdateIfPossible(internal, nodeId, state);
    return;
  }

  internal.currentData = applied.data;
  syncCommittedViewportToStreams(internal, applied.canonicalId, state);

  const lastAutoCheckpoint = [...internal.checkpoints]
    .reverse()
    .find((checkpoint) => checkpoint.trigger === 'auto');
  if (lastAutoCheckpoint) {
    const snapshot = buildCommittedSnapshotFromCurrentState(internal);
    if (snapshot) {
      lastAutoCheckpoint.snapshot = cloneCheckpointSnapshot(snapshot);
    }
  }

  notifySnapshotListeners(internal);
}

function assembleSessionFromInternalState(
  internal: SessionState,
  cleanupPersistence?: () => void
): Session {
  const session: Session = {
    get sessionId() {
      return internal.sessionId;
    },
    get isDestroyed() {
      return internal.destroyed;
    },
    getSnapshot() {
      assertNotDestroyed(internal);
      return buildRenderSnapshotFromCurrentState(internal);
    },
    getCommittedSnapshot() {
      assertNotDestroyed(internal);
      return buildCommittedSnapshotFromCurrentState(internal);
    },
    getIssues() {
      assertNotDestroyed(internal);
      return [
        ...(internal.activeForegroundStreamId &&
        internal.streams.get(internal.activeForegroundStreamId)?.status === 'open'
          ? internal.streams.get(internal.activeForegroundStreamId)?.issues ?? []
          : internal.issues),
      ];
    },
    getDiffs() {
      assertNotDestroyed(internal);
      return [
        ...(internal.activeForegroundStreamId &&
        internal.streams.get(internal.activeForegroundStreamId)?.status === 'open'
          ? internal.streams.get(internal.activeForegroundStreamId)?.diffs ?? []
          : internal.diffs),
      ];
    },
    getResolutions() {
      assertNotDestroyed(internal);
      return [
        ...(internal.activeForegroundStreamId &&
        internal.streams.get(internal.activeForegroundStreamId)?.status === 'open'
          ? internal.streams.get(internal.activeForegroundStreamId)?.resolutions ?? []
          : internal.resolutions),
      ];
    },
    getEventLog() {
      assertNotDestroyed(internal);
      return [...internal.eventLog];
    },
    getPendingIntents() {
      assertNotDestroyed(internal);
      return [...internal.pendingIntents];
    },
    getDetachedValues() {
      assertNotDestroyed(internal);
      return { ...(internal.currentData?.detachedValues ?? {}) };
    },
    purgeDetachedValues(
      filter?: (key: string, value: DetachedValue) => boolean
    ) {
      assertNotDestroyed(internal);
      if (!internal.currentData?.detachedValues) return;
      if (!filter) {
        const rest = { ...internal.currentData };
        delete rest.detachedValues;
        internal.currentData = rest;
      } else {
        const remaining: Record<string, DetachedValue> = {};
        for (const [key, value] of Object.entries(
          internal.currentData.detachedValues
        )) {
          if (!filter(key, value)) {
            remaining[key] = value;
          }
        }
        if (Object.keys(remaining).length === 0) {
          const rest = { ...internal.currentData };
          delete rest.detachedValues;
          internal.currentData = rest;
        } else {
          internal.currentData = {
            ...internal.currentData,
            detachedValues: remaining,
          };
        }
      }
      notifySnapshotListeners(internal);
    },
    proposeValue(nodeId: string, value: NodeValue, source?: string) {
      assertNotDestroyed(internal);
      const decision = classifyContinuumValueIngress({
        view: internal.currentView,
        data: internal.currentData,
        nodeId,
      });

      if (decision.kind === 'unknown-node') {
        return;
      }

      if (decision.kind === 'proposal') {
        internal.pendingProposals[decision.canonicalId] = {
          nodeId: decision.canonicalId,
          proposedValue: value,
          currentValue: decision.currentValue ?? { value: undefined },
          proposedAt: internal.clock(),
          source,
        };
        notifySnapshotListeners(internal);
      } else {
        recordIntent(internal, {
          nodeId,
          type: INTERACTION_TYPES.DATA_UPDATE,
          payload: value,
        });
        delete internal.pendingProposals[decision.canonicalId];
      }
    },
    acceptProposal(nodeId: string) {
      assertNotDestroyed(internal);
      const proposalKey =
        internal.currentView && resolveNodeLookupEntry(internal.currentView.nodes, nodeId)
          ? resolveNodeLookupEntry(internal.currentView.nodes, nodeId)!.canonicalId
          : nodeId;
      const proposal = internal.pendingProposals[proposalKey];
      if (!proposal) return;
      recordIntent(internal, {
        nodeId,
        type: INTERACTION_TYPES.DATA_UPDATE,
        payload: { ...proposal.proposedValue, isDirty: true },
      });
      delete internal.pendingProposals[proposalKey];
    },
    rejectProposal(nodeId: string) {
      assertNotDestroyed(internal);
      const proposalKey =
        internal.currentView && resolveNodeLookupEntry(internal.currentView.nodes, nodeId)
          ? resolveNodeLookupEntry(internal.currentView.nodes, nodeId)!.canonicalId
          : nodeId;
      if (!internal.pendingProposals[proposalKey]) {
        return;
      }
      delete internal.pendingProposals[proposalKey];
      notifySnapshotListeners(internal);
    },
    getPendingProposals() {
      assertNotDestroyed(internal);
      return { ...internal.pendingProposals };
    },
    getCheckpoints() {
      assertNotDestroyed(internal);
      return [...internal.checkpoints];
    },

    beginStream(options) {
      assertNotDestroyed(internal);
      return beginStream(internal, options);
    },
    applyStreamPart(streamId, part) {
      assertNotDestroyed(internal);
      applyStreamPart(internal, streamId, part);
    },
    commitStream(streamId) {
      assertNotDestroyed(internal);
      return commitStream(internal, streamId);
    },
    abortStream(streamId, reason) {
      assertNotDestroyed(internal);
      return abortStream(internal, streamId, reason);
    },
    getStreams() {
      assertNotDestroyed(internal);
      return getPublicStreams(internal);
    },

    pushView(view, options) {
      assertNotDestroyed(internal);
      pushView(internal, view, options);
    },
    recordIntent(partial) {
      assertNotDestroyed(internal);
      recordIntent(internal, partial);
    },
    updateState(nodeId, payload) {
      assertNotDestroyed(internal);
      recordIntent(internal, {
        nodeId,
        type: INTERACTION_TYPES.DATA_UPDATE,
        payload,
      });
    },
    getViewportState(nodeId) {
      assertNotDestroyed(internal);
      const canonicalId =
        internal.currentView && resolveNodeLookupEntry(internal.currentView.nodes, nodeId)
          ? resolveNodeLookupEntry(internal.currentView.nodes, nodeId)!.canonicalId
          : nodeId;
      return internal.currentData?.viewContext?.[canonicalId];
    },
    updateViewportState(nodeId, state) {
      assertNotDestroyed(internal);
      applyViewportStateUpdate(internal, nodeId, state);
    },

    submitIntent(partial) {
      assertNotDestroyed(internal);
      submitIntent(internal, partial);
    },
    validateIntent(intentId) {
      assertNotDestroyed(internal);
      return validateIntent(internal, intentId);
    },
    cancelIntent(intentId) {
      assertNotDestroyed(internal);
      return cancelIntent(internal, intentId);
    },

    checkpoint() {
      assertNotDestroyed(internal);
      return createManualCheckpoint(internal);
    },
    restoreFromCheckpoint(cp) {
      assertNotDestroyed(internal);
      restoreFromCheckpoint(internal, cp);
    },
    rewind(checkpointId) {
      assertNotDestroyed(internal);
      rewind(internal, checkpointId);
    },
    reset() {
      assertNotDestroyed(internal);
      resetSessionState(internal);
      notifySnapshotAndIssueListeners(internal);
      notifyStreamListeners(internal);
    },

    onSnapshot(listener) {
      assertNotDestroyed(internal);
      return subscribeSnapshot(internal, listener);
    },
    onStreams(listener) {
      assertNotDestroyed(internal);
      return subscribeStreams(internal, listener);
    },
    onIssues(listener) {
      assertNotDestroyed(internal);
      return subscribeIssues(internal, listener);
    },

    serialize() {
      assertNotDestroyed(internal);
      return serializeSession(internal);
    },
    destroy() {
      assertNotDestroyed(internal);
      cleanupPersistence?.();
      return teardownSessionAndClearState(internal);
    },
    registerAction(
      intentId: string,
      registration: ActionRegistration,
      handler: ActionHandler
    ) {
      assertNotDestroyed(internal);
      internal.actionRegistry.set(intentId, { registration, handler });
    },
    unregisterAction(intentId: string) {
      assertNotDestroyed(internal);
      internal.actionRegistry.delete(intentId);
    },
    getRegisteredActions() {
      assertNotDestroyed(internal);
      const result: Record<string, ActionRegistration> = {};
      for (const [id, entry] of internal.actionRegistry) {
        result[id] = entry.registration;
      }
      return result;
    },
    async dispatchAction(
      intentId: string,
      nodeId: string
    ): Promise<ActionResult> {
      assertNotDestroyed(internal);
      const entry = internal.actionRegistry.get(intentId);
      if (!entry) {
        console.warn(
          `[Continuum] dispatchAction: no handler registered for intentId "${intentId}"`
        );
        return {
          success: false,
          error: `No handler registered for intentId "${intentId}"`,
        };
      }
      const snapshot = session.getSnapshot();
      if (!snapshot) {
        return { success: false, error: 'No active snapshot' };
      }
      const sessionRef: ActionSessionRef = {
        pushView: (v) => session.pushView(v),
        updateState: (id, p) => session.updateState(id, p),
        getSnapshot: () => session.getSnapshot(),
        proposeValue: (id, v, s) => session.proposeValue(id, v, s),
      };
      try {
        const raw = await entry.handler({
          intentId,
          snapshot: snapshot.data,
          nodeId,
          session: sessionRef,
        });
        return raw ?? { success: true };
      } catch (error) {
        return { success: false, error };
      }
    },
    async executeIntent(partial) {
      assertNotDestroyed(internal);
      submitIntent(internal, partial);
      const intent =
        internal.pendingIntents[internal.pendingIntents.length - 1];
      try {
        const result = await session.dispatchAction(
          partial.intentName,
          partial.nodeId
        );
        if (result.success) {
          validateIntent(internal, intent.intentId);
        } else {
          cancelIntent(internal, intent.intentId);
        }
        return result;
      } catch (error) {
        cancelIntent(internal, intent.intentId);
        return { success: false, error };
      }
    },
  };

  return session;
}

/**
 * Creates a new in-memory session ledger.
 *
 * Initializes event log limits, reconciliation behavior, optional persistence,
 * and optional action handlers.
 *
 * @param options Optional session configuration.
 * @returns A live session instance.
 */
export function createSession(options?: SessionOptions): Session {
  const clock = options?.clock ?? Date.now;
  const internal = createEmptySessionState(generateId('session', clock), clock);
  internal.maxEventLogSize =
    options?.maxEventLogSize ?? internal.maxEventLogSize;
  internal.maxPendingIntents =
    options?.maxPendingIntents ?? internal.maxPendingIntents;
  internal.maxCheckpoints = options?.maxCheckpoints ?? internal.maxCheckpoints;
  internal.reconciliationOptions = options?.reconciliation;
  internal.validateOnUpdate =
    options?.validateOnUpdate ?? internal.validateOnUpdate;
  internal.detachedValuePolicy = options?.detachedValuePolicy;
  if (options?.actions) {
    for (const [id, entry] of Object.entries(options.actions)) {
      internal.actionRegistry.set(id, entry);
    }
  }
  const cleanupPersistence = options?.persistence
    ? attachPersistence(internal, {
        ...options.persistence,
        key: options.persistence.key ?? DEFAULT_STORAGE_KEY,
      })
    : undefined;
  return assembleSessionFromInternalState(internal, cleanupPersistence);
}

/**
 * Recreates a session from serialized data produced by `session.serialize()`.
 *
 * @param data Serialized session payload.
 * @param options Optional runtime overrides (clock, limits, reconciliation, persistence).
 * @returns A live session instance restored from the payload.
 */
export function deserialize(data: unknown, options?: SessionOptions): Session {
  const internal = deserializeToState(data, options?.clock ?? Date.now, {
    maxEventLogSize: options?.maxEventLogSize,
    maxPendingIntents: options?.maxPendingIntents,
    maxCheckpoints: options?.maxCheckpoints,
  });
  if (options?.reconciliation) {
    internal.reconciliationOptions = options.reconciliation;
  }
  if (options?.validateOnUpdate !== undefined) {
    internal.validateOnUpdate = options.validateOnUpdate;
  }
  const cleanupPersistence = options?.persistence
    ? attachPersistence(internal, {
        ...options.persistence,
        key: options.persistence.key ?? DEFAULT_STORAGE_KEY,
      })
    : undefined;
  return assembleSessionFromInternalState(internal, cleanupPersistence);
}

/**
 * Hydrates a session from persistence storage when data exists, otherwise creates a new one.
 *
 * If stored data is invalid, it is removed and a fresh session is created.
 *
 * @param options Session options including required persistence config.
 * @returns A hydrated or newly created session.
 */
export function hydrateOrCreate(options?: SessionOptions): Session {
  if (!options?.persistence) return createSession(options);
  const storageKey = options.persistence.key ?? DEFAULT_STORAGE_KEY;
  const raw = options.persistence.storage.getItem(storageKey);
  if (!raw) return createSession(options);
  try {
    return deserialize(JSON.parse(raw), options);
  } catch {
    options.persistence.storage.removeItem(storageKey);
    return createSession(options);
  }
}

/**
 * Dependency-injection friendly factory for session creation and deserialization.
 */
export const sessionFactory: SessionFactory = { createSession, deserialize };
