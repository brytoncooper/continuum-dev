import type { PendingIntent } from '@continuum/contract';
import { INTENT_STATUS } from '@continuum/contract';
import type { SessionState } from './session-state.js';
import { generateId } from './session-state.js';

export function submitIntent(
  internal: SessionState,
  partial: Omit<PendingIntent, 'intentId' | 'queuedAt' | 'status' | 'viewVersion'>
): void {
  if (internal.destroyed || !internal.currentView) return;

  const intent: PendingIntent = {
    intentId: generateId('intent', internal.clock),
    nodeId: partial.nodeId,
    intentName: partial.intentName,
    payload: partial.payload,
    queuedAt: internal.clock(),
    viewVersion: internal.currentView.version,
    status: INTENT_STATUS.PENDING,
  };

  internal.pendingIntents.push(intent);
  if (internal.pendingIntents.length > internal.maxPendingIntents) {
    internal.pendingIntents.splice(0, internal.pendingIntents.length - internal.maxPendingIntents);
  }
}

export function validateIntent(internal: SessionState, intentId: string): boolean {
  const intent = internal.pendingIntents.find((a) => a.intentId === intentId);
  if (!intent) return false;
  intent.status = INTENT_STATUS.VALIDATED;
  return true;
}

export function cancelIntent(internal: SessionState, intentId: string): boolean {
  const intent = internal.pendingIntents.find((a) => a.intentId === intentId);
  if (!intent) return false;
  intent.status = INTENT_STATUS.CANCELLED;
  return true;
}

export function markAllPendingIntentsAsStale(internal: SessionState): void {
  for (const intent of internal.pendingIntents) {
    if (intent.status === INTENT_STATUS.PENDING) {
      intent.status = INTENT_STATUS.STALE;
    }
  }
}
