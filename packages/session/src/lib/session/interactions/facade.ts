import {
  mapNestedCollectionValues,
  type NodeValue,
  type ValueProtectionOwner,
  type ValueProtectionStage,
} from '@continuum-dev/contract';
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
import type { ProtectionChangeResult } from '../../types.js';

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
  | 'reviewValues'
  | 'lockValues'
  | 'unlockValues'
  | 'submitValues'
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
  const resolveCanonicalNodeId = (nodeId: string): string | null => {
    if (!internal.currentView) {
      return null;
    }

    const lookup = resolveNodeLookupEntry(internal.currentView.nodes, nodeId);
    return lookup?.canonicalId ?? null;
  };

  const createChangeResult = (): ProtectionChangeResult => ({
    appliedNodeIds: [],
    blockedConflictNodeIds: [],
    preservedDirtyNodeIds: [],
    preservedLockedNodeIds: [],
    preservedSubmittedNodeIds: [],
    missingNodeIds: [],
  });

  const readOwner = (value: NodeValue | undefined): ValueProtectionOwner =>
    value?.isDirty === true ? 'user' : value?.protection?.owner ?? 'ai';

  const readStage = (value: NodeValue | undefined): ValueProtectionStage =>
    value?.protection?.stage ?? 'flexible';

  const mapNodeValueRecursively = (
    value: NodeValue,
    transform: (candidate: NodeValue) => NodeValue
  ): NodeValue => {
    const next = transform(structuredClone(value) as NodeValue);
    next.value = mapNestedCollectionValues(next.value, (nestedValue) =>
      mapNodeValueRecursively(nestedValue, transform)
    );
    return next;
  };

  const clearSuggestionsAndSetProtection = (
    value: NodeValue,
    owner: ValueProtectionOwner,
    stage: ValueProtectionStage
  ): NodeValue =>
    mapNodeValueRecursively(value, (candidate) => {
      const next = { ...candidate } as NodeValue & {
        suggestion?: unknown;
      };
      delete next.suggestion;
      next.protection = { owner, stage };
      return next;
    });

  const hasPendingSuggestion = (value: NodeValue | undefined): boolean => {
    if (!value) {
      return false;
    }

    if (value.suggestion !== undefined) {
      return true;
    }

    const nested = mapNestedCollectionValues(
      value.value,
      (nestedValue) => nestedValue
    ) as { items?: Array<{ values?: Record<string, NodeValue> }> } | unknown;
    const items = (
      nested as { items?: Array<{ values?: Record<string, NodeValue> }> }
    )?.items;
    if (!Array.isArray(items)) {
      return false;
    }

    return items.some((item) =>
      Object.values(item.values ?? {}).some((nodeValue) =>
        hasPendingSuggestion(nodeValue)
      )
    );
  };

  const clearProposalForNode = (canonicalId: string): void => {
    delete internal.pendingProposals[canonicalId];
  };

  const applyProtectionChange = (
    canonicalId: string,
    type:
      | typeof INTERACTION_TYPES.VALUE_REVIEW
      | typeof INTERACTION_TYPES.VALUE_LOCK
      | typeof INTERACTION_TYPES.VALUE_UNLOCK
      | typeof INTERACTION_TYPES.VALUE_SUBMIT,
    value: NodeValue
  ): void => {
    recordIntent(internal, {
      nodeId: canonicalId,
      type,
      payload: value,
    });
  };

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
      const proposalKey = resolveCanonicalNodeId(nodeId) ?? nodeId;
      const proposal = internal.pendingProposals[proposalKey];
      if (!proposal) return;
      clearProposalForNode(proposalKey);
      applyProtectionChange(
        proposalKey,
        INTERACTION_TYPES.VALUE_REVIEW,
        clearSuggestionsAndSetProtection(proposal.proposedValue, 'ai', 'reviewed')
      );
    },
    rejectProposal(nodeId: string) {
      assertNotDestroyed(internal);
      const proposalKey = resolveCanonicalNodeId(nodeId) ?? nodeId;
      if (!internal.pendingProposals[proposalKey]) return;

      const currentValue = internal.currentData?.values[proposalKey];
      clearProposalForNode(proposalKey);

      if (
        currentValue &&
        currentValue.isDirty !== true &&
        readOwner(currentValue) === 'ai' &&
        readStage(currentValue) === 'flexible'
      ) {
        applyProtectionChange(
          proposalKey,
          INTERACTION_TYPES.VALUE_REVIEW,
          clearSuggestionsAndSetProtection(currentValue, 'ai', 'reviewed')
        );
        return;
      }

      notifySnapshotListeners(internal);
    },
    reviewValues(nodeIds: string[]) {
      assertNotDestroyed(internal);
      const result = createChangeResult();

      for (const nodeId of nodeIds) {
        const canonicalId = resolveCanonicalNodeId(nodeId);
        if (!canonicalId) {
          result.missingNodeIds.push(nodeId);
          continue;
        }

        const currentValue = internal.currentData?.values[canonicalId];
        if (!currentValue) {
          continue;
        }

        if (
          internal.pendingProposals[canonicalId] ||
          hasPendingSuggestion(currentValue)
        ) {
          result.blockedConflictNodeIds.push(canonicalId);
          continue;
        }

        if (currentValue.isDirty === true) {
          result.preservedDirtyNodeIds.push(canonicalId);
          continue;
        }

        const owner = readOwner(currentValue);
        const stage = readStage(currentValue);
        if (stage === 'locked') {
          result.preservedLockedNodeIds.push(canonicalId);
          continue;
        }
        if (stage === 'submitted') {
          result.preservedSubmittedNodeIds.push(canonicalId);
          continue;
        }
        if (owner !== 'ai' || stage !== 'flexible') {
          continue;
        }

        applyProtectionChange(
          canonicalId,
          INTERACTION_TYPES.VALUE_REVIEW,
          clearSuggestionsAndSetProtection(currentValue, 'ai', 'reviewed')
        );
        result.appliedNodeIds.push(canonicalId);
      }

      return result;
    },
    lockValues(nodeIds: string[]) {
      assertNotDestroyed(internal);
      const result = createChangeResult();

      for (const nodeId of nodeIds) {
        const canonicalId = resolveCanonicalNodeId(nodeId);
        if (!canonicalId) {
          result.missingNodeIds.push(nodeId);
          continue;
        }

        const currentValue = internal.currentData?.values[canonicalId];
        if (!currentValue) {
          continue;
        }

        const stage = readStage(currentValue);
        if (stage === 'submitted') {
          result.preservedSubmittedNodeIds.push(canonicalId);
          continue;
        }
        if (stage === 'locked') {
          result.preservedLockedNodeIds.push(canonicalId);
          continue;
        }

        clearProposalForNode(canonicalId);
        applyProtectionChange(
          canonicalId,
          INTERACTION_TYPES.VALUE_LOCK,
          clearSuggestionsAndSetProtection(
            currentValue,
            readOwner(currentValue),
            'locked'
          )
        );
        result.appliedNodeIds.push(canonicalId);
      }

      return result;
    },
    unlockValues(nodeIds: string[]) {
      assertNotDestroyed(internal);
      const result = createChangeResult();

      for (const nodeId of nodeIds) {
        const canonicalId = resolveCanonicalNodeId(nodeId);
        if (!canonicalId) {
          result.missingNodeIds.push(nodeId);
          continue;
        }

        const currentValue = internal.currentData?.values[canonicalId];
        if (!currentValue) {
          continue;
        }

        if (currentValue.isDirty === true) {
          result.preservedDirtyNodeIds.push(canonicalId);
          continue;
        }

        const owner = readOwner(currentValue);
        const stage = readStage(currentValue);
        if (stage === 'submitted') {
          result.preservedSubmittedNodeIds.push(canonicalId);
          continue;
        }
        if (owner !== 'ai') {
          if (stage === 'locked') {
            result.preservedLockedNodeIds.push(canonicalId);
          }
          continue;
        }
        if (stage !== 'reviewed' && stage !== 'locked') {
          continue;
        }

        applyProtectionChange(
          canonicalId,
          INTERACTION_TYPES.VALUE_UNLOCK,
          clearSuggestionsAndSetProtection(currentValue, 'ai', 'flexible')
        );
        result.appliedNodeIds.push(canonicalId);
      }

      return result;
    },
    submitValues(nodeIds: string[]) {
      assertNotDestroyed(internal);
      const result = createChangeResult();

      for (const nodeId of nodeIds) {
        const canonicalId = resolveCanonicalNodeId(nodeId);
        if (!canonicalId) {
          result.missingNodeIds.push(nodeId);
          continue;
        }

        const currentValue = internal.currentData?.values[canonicalId];
        if (!currentValue) {
          continue;
        }

        if (readStage(currentValue) === 'submitted') {
          result.preservedSubmittedNodeIds.push(canonicalId);
          continue;
        }

        clearProposalForNode(canonicalId);
        applyProtectionChange(
          canonicalId,
          INTERACTION_TYPES.VALUE_SUBMIT,
          clearSuggestionsAndSetProtection(
            currentValue,
            readOwner(currentValue),
            'submitted'
          )
        );
        result.appliedNodeIds.push(canonicalId);
      }

      return result;
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
