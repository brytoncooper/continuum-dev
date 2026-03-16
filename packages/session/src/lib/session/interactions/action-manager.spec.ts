import { describe, it, expect } from 'vitest';
import { createEmptySessionState } from '../state/index.js';
import { submitIntent, validateIntent, cancelIntent, markAllPendingIntentsAsStale } from './intent-manager.js';

describe('submitIntent', () => {
  it('adds a pending intent with status pending', () => {
    const internal = createEmptySessionState('s', () => 1000);
    internal.currentView = { viewId: 's1', version: '1.0', nodes: [] };

    submitIntent(internal, { nodeId: 'a', intentName: 'submit', payload: {} });

    expect(internal.pendingIntents).toHaveLength(1);
    expect(internal.pendingIntents[0].status).toBe('pending');
    expect(internal.pendingIntents[0].nodeId).toBe('a');
  });

  it('does nothing when session is destroyed', () => {
    const internal = createEmptySessionState('s', () => 1000);
    internal.currentView = { viewId: 's1', version: '1.0', nodes: [] };
    internal.destroyed = true;

    submitIntent(internal, { nodeId: 'a', intentName: 'submit', payload: {} });

    expect(internal.pendingIntents).toHaveLength(0);
  });

  it('does nothing when no view is set', () => {
    const internal = createEmptySessionState('s', () => 1000);

    submitIntent(internal, { nodeId: 'a', intentName: 'submit', payload: {} });

    expect(internal.pendingIntents).toHaveLength(0);
  });
});

describe('validateIntent', () => {
  it('transitions intent to validated', () => {
    const internal = createEmptySessionState('s', () => 1000);
    internal.currentView = { viewId: 's1', version: '1.0', nodes: [] };
    submitIntent(internal, { nodeId: 'a', intentName: 'submit', payload: {} });

    const intentId = internal.pendingIntents[0].intentId;
    validateIntent(internal, intentId);

    expect(internal.pendingIntents[0].status).toBe('validated');
  });
});

describe('cancelIntent', () => {
  it('transitions intent to cancelled', () => {
    const internal = createEmptySessionState('s', () => 1000);
    internal.currentView = { viewId: 's1', version: '1.0', nodes: [] };
    submitIntent(internal, { nodeId: 'a', intentName: 'submit', payload: {} });

    const intentId = internal.pendingIntents[0].intentId;
    cancelIntent(internal, intentId);

    expect(internal.pendingIntents[0].status).toBe('cancelled');
  });
});

describe('markAllPendingIntentsAsStale', () => {
  it('marks all pending intents as stale', () => {
    const internal = createEmptySessionState('s', () => 1000);
    internal.currentView = { viewId: 's1', version: '1.0', nodes: [] };
    submitIntent(internal, { nodeId: 'a', intentName: 'submit', payload: {} });
    submitIntent(internal, { nodeId: 'b', intentName: 'submit', payload: {} });

    markAllPendingIntentsAsStale(internal);

    expect(internal.pendingIntents.every((a) => a.status === 'stale')).toBe(true);
  });

  it('does not affect already validated or cancelled intents', () => {
    const internal = createEmptySessionState('s', () => 1000);
    internal.currentView = { viewId: 's1', version: '1.0', nodes: [] };
    submitIntent(internal, { nodeId: 'a', intentName: 'submit', payload: {} });
    submitIntent(internal, { nodeId: 'b', intentName: 'submit', payload: {} });

    validateIntent(internal, internal.pendingIntents[0].intentId);
    cancelIntent(internal, internal.pendingIntents[1].intentId);

    markAllPendingIntentsAsStale(internal);

    expect(internal.pendingIntents[0].status).toBe('validated');
    expect(internal.pendingIntents[1].status).toBe('cancelled');
  });
});
