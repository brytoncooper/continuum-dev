import type { NodeValue } from '@continuum-dev/contract';
import type {
  ActionRegistration,
  ActionResult,
  ActionSessionRef,
} from '@continuum-dev/protocol';
import { INTERACTION_TYPES } from '@continuum-dev/protocol';
import { decideContinuumNodeValueWrite } from '@continuum-dev/runtime';
import { resolveNodeLookupEntry } from '@continuum-dev/runtime/node-lookup';
import type { Session } from '../../types.js';
import type { SessionState } from '../state/index.js';
import {
  submitIntent,
  validateIntent,
  cancelIntent,
  recordIntent,
} from './index.js';
import { notifySnapshotListeners } from '../listeners/index.js';

function assertNotDestroyed(internal: SessionState): void {
  if (internal.destroyed) {
    throw new Error('Session has been destroyed');
  }
}

export function createInteractionsFacade(
  internal: SessionState,
  sessionRef: Session
): Pick<
  Session,
  | 'getPendingIntents'
  | 'proposeValue'
  | 'acceptProposal'
  | 'rejectProposal'
  | 'getPendingProposals'
  | 'recordIntent'
  | 'updateState'
  | 'submitIntent'
  | 'validateIntent'
  | 'cancelIntent'
  | 'registerAction'
  | 'unregisterAction'
  | 'getRegisteredActions'
  | 'dispatchAction'
  | 'executeIntent'
> {
  return {
    getPendingIntents() {
      assertNotDestroyed(internal);
      return [...internal.pendingIntents];
    },
    proposeValue(nodeId: string, value: NodeValue, source?: string) {
      assertNotDestroyed(internal);
      const decision = decideContinuumNodeValueWrite({
        view: internal.currentView,
        data: internal.currentData,
        nodeId,
      });

      if (decision.kind === 'unknown-node') return;

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
        internal.currentView &&
        resolveNodeLookupEntry(internal.currentView.nodes, nodeId)
          ? resolveNodeLookupEntry(internal.currentView.nodes, nodeId)!
              .canonicalId
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
        internal.currentView &&
        resolveNodeLookupEntry(internal.currentView.nodes, nodeId)
          ? resolveNodeLookupEntry(internal.currentView.nodes, nodeId)!
              .canonicalId
          : nodeId;
      if (!internal.pendingProposals[proposalKey]) return;
      delete internal.pendingProposals[proposalKey];
      notifySnapshotListeners(internal);
    },
    getPendingProposals() {
      assertNotDestroyed(internal);
      return { ...internal.pendingProposals };
    },
    recordIntent(partial: Parameters<Session['recordIntent']>[0]) {
      assertNotDestroyed(internal);
      recordIntent(internal, partial);
    },
    updateState(nodeId: string, payload: unknown) {
      assertNotDestroyed(internal);
      recordIntent(internal, {
        nodeId,
        type: INTERACTION_TYPES.DATA_UPDATE,
        payload,
      });
    },
    submitIntent(partial: Parameters<Session['submitIntent']>[0]) {
      assertNotDestroyed(internal);
      submitIntent(internal, partial);
    },
    validateIntent(intentId: string) {
      assertNotDestroyed(internal);
      return validateIntent(internal, intentId);
    },
    cancelIntent(intentId: string) {
      assertNotDestroyed(internal);
      return cancelIntent(internal, intentId);
    },
    registerAction(
      intentId: string,
      registration: Parameters<Session['registerAction']>[1],
      handler: Parameters<Session['registerAction']>[2]
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
      const snapshot = sessionRef.getSnapshot();
      if (!snapshot) {
        return { success: false, error: 'No active snapshot' };
      }
      const ref: ActionSessionRef = {
        pushView: (v: Parameters<Session['pushView']>[0]) =>
          sessionRef.pushView(v),
        updateState: (id: string, p: unknown) => sessionRef.updateState(id, p),
        getSnapshot: () => sessionRef.getSnapshot(),
        proposeValue: (id: string, v: NodeValue, s?: string) =>
          sessionRef.proposeValue(id, v, s),
      };
      try {
        const raw = await entry.handler({
          intentId,
          snapshot: snapshot.data,
          nodeId,
          session: ref,
        });
        return raw ?? { success: true };
      } catch (error) {
        return { success: false, error };
      }
    },
    async executeIntent(partial: Parameters<Session['executeIntent']>[0]) {
      assertNotDestroyed(internal);
      submitIntent(internal, partial);
      const intent =
        internal.pendingIntents[internal.pendingIntents.length - 1];
      try {
        const result = await sessionRef.dispatchAction(
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
}
