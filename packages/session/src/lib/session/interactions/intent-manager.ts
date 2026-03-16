import type { PendingIntent } from '@continuum-dev/protocol';
import { INTENT_STATUS } from '@continuum-dev/protocol';
import type { SessionState } from '../state/index.js';
import { generateId } from '../state/index.js';

/**
 * Queues a pending intent on the current view version.
 *
 * @param internal Mutable internal session state.
 * @param partial Intent payload without generated metadata.
 */
export function submitIntent(
  internal: SessionState,
  partial: Omit<
    PendingIntent,
    'intentId' | 'queuedAt' | 'status' | 'viewVersion'
  >
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
    internal.pendingIntents.splice(
      0,
      internal.pendingIntents.length - internal.maxPendingIntents
    );
  }
}

/**
 * Marks an intent as validated.
 *
 * @param internal Mutable internal session state.
 * @param intentId Target intent id.
 * @returns True when the intent exists.
 */
export function validateIntent(
  internal: SessionState,
  intentId: string
): boolean {
  const intent = internal.pendingIntents.find((a) => a.intentId === intentId);
  if (!intent) return false;
  intent.status = INTENT_STATUS.VALIDATED;
  return true;
}

/**
 * Marks an intent as cancelled.
 *
 * @param internal Mutable internal session state.
 * @param intentId Target intent id.
 * @returns True when the intent exists.
 */
export function cancelIntent(
  internal: SessionState,
  intentId: string
): boolean {
  const intent = internal.pendingIntents.find((a) => a.intentId === intentId);
  if (!intent) return false;
  intent.status = INTENT_STATUS.CANCELLED;
  return true;
}

/**
 * Marks all currently pending intents as stale.
 *
 * Used when view version changes invalidate unresolved intents.
 *
 * @param internal Mutable internal session state.
 */
export function markAllPendingIntentsAsStale(internal: SessionState): void {
  for (const intent of internal.pendingIntents) {
    if (intent.status === INTENT_STATUS.PENDING) {
      intent.status = INTENT_STATUS.STALE;
    }
  }
}
