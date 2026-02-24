import type { PendingAction } from '@continuum/contract';
import { ACTION_STATUS } from '@continuum/contract';
import type { SessionState } from './session-state.js';
import { generateId } from './session-state.js';

export function submitAction(
  internal: SessionState,
  partial: Omit<PendingAction, 'id' | 'createdAt' | 'status' | 'schemaVersion'>
): void {
  if (internal.destroyed || !internal.currentSchema) return;

  const action: PendingAction = {
    id: generateId('action', internal.clock),
    componentId: partial.componentId,
    actionType: partial.actionType,
    payload: partial.payload,
    createdAt: internal.clock(),
    schemaVersion: internal.currentSchema.version,
    status: ACTION_STATUS.PENDING,
  };

  internal.pendingActions.push(action);
}

export function validateAction(internal: SessionState, actionId: string): void {
  const action = internal.pendingActions.find((a) => a.id === actionId);
  if (action) action.status = ACTION_STATUS.VALIDATED;
}

export function cancelAction(internal: SessionState, actionId: string): void {
  const action = internal.pendingActions.find((a) => a.id === actionId);
  if (action) action.status = ACTION_STATUS.CANCELLED;
}

export function stalePendingActions(internal: SessionState): void {
  for (const action of internal.pendingActions) {
    if (action.status === ACTION_STATUS.PENDING) {
      action.status = ACTION_STATUS.STALE;
    }
  }
}
