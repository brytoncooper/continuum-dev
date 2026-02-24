import { describe, it, expect } from 'vitest';
import { createEmptySessionState } from './session-state.js';
import { submitAction, validateAction, cancelAction, markAllPendingActionsAsStale } from './action-manager.js';

describe('submitAction', () => {
  it('adds a pending action with status pending', () => {
    const internal = createEmptySessionState('s', () => 1000);
    internal.currentSchema = { schemaId: 's1', version: '1.0', components: [] };

    submitAction(internal, { componentId: 'a', actionType: 'submit', payload: {} });

    expect(internal.pendingActions).toHaveLength(1);
    expect(internal.pendingActions[0].status).toBe('pending');
    expect(internal.pendingActions[0].componentId).toBe('a');
  });

  it('does nothing when session is destroyed', () => {
    const internal = createEmptySessionState('s', () => 1000);
    internal.currentSchema = { schemaId: 's1', version: '1.0', components: [] };
    internal.destroyed = true;

    submitAction(internal, { componentId: 'a', actionType: 'submit', payload: {} });

    expect(internal.pendingActions).toHaveLength(0);
  });

  it('does nothing when no schema is set', () => {
    const internal = createEmptySessionState('s', () => 1000);

    submitAction(internal, { componentId: 'a', actionType: 'submit', payload: {} });

    expect(internal.pendingActions).toHaveLength(0);
  });
});

describe('validateAction', () => {
  it('transitions action to validated', () => {
    const internal = createEmptySessionState('s', () => 1000);
    internal.currentSchema = { schemaId: 's1', version: '1.0', components: [] };
    submitAction(internal, { componentId: 'a', actionType: 'submit', payload: {} });

    const actionId = internal.pendingActions[0].id;
    validateAction(internal, actionId);

    expect(internal.pendingActions[0].status).toBe('validated');
  });
});

describe('cancelAction', () => {
  it('transitions action to cancelled', () => {
    const internal = createEmptySessionState('s', () => 1000);
    internal.currentSchema = { schemaId: 's1', version: '1.0', components: [] };
    submitAction(internal, { componentId: 'a', actionType: 'submit', payload: {} });

    const actionId = internal.pendingActions[0].id;
    cancelAction(internal, actionId);

    expect(internal.pendingActions[0].status).toBe('cancelled');
  });
});

describe('markAllPendingActionsAsStale', () => {
  it('marks all pending actions as stale', () => {
    const internal = createEmptySessionState('s', () => 1000);
    internal.currentSchema = { schemaId: 's1', version: '1.0', components: [] };
    submitAction(internal, { componentId: 'a', actionType: 'submit', payload: {} });
    submitAction(internal, { componentId: 'b', actionType: 'submit', payload: {} });

    markAllPendingActionsAsStale(internal);

    expect(internal.pendingActions.every((a) => a.status === 'stale')).toBe(true);
  });

  it('does not affect already validated or cancelled actions', () => {
    const internal = createEmptySessionState('s', () => 1000);
    internal.currentSchema = { schemaId: 's1', version: '1.0', components: [] };
    submitAction(internal, { componentId: 'a', actionType: 'submit', payload: {} });
    submitAction(internal, { componentId: 'b', actionType: 'submit', payload: {} });

    validateAction(internal, internal.pendingActions[0].id);
    cancelAction(internal, internal.pendingActions[1].id);

    markAllPendingActionsAsStale(internal);

    expect(internal.pendingActions[0].status).toBe('validated');
    expect(internal.pendingActions[1].status).toBe('cancelled');
  });
});
