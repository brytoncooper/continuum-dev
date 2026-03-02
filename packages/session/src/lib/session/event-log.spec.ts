import { describe, it, expect, vi } from 'vitest';
import { createEmptySessionState } from './session-state.js';
import { recordIntent } from './event-log.js';

function setupWithView(internal: ReturnType<typeof createEmptySessionState>) {
  internal.currentView = { viewId: 's1', version: '1.0', nodes: [{ id: 'a', type: 'field' as const, dataType: 'string' as const }] };
  internal.currentData = { values: {}, lineage: { timestamp: 1000, sessionId: 's' } };
}

describe('recordIntent', () => {
  it('adds an interaction to the event log', () => {
    const internal = createEmptySessionState('s', () => 5000);
    setupWithView(internal);

    recordIntent(internal, { nodeId: 'a', type: 'value-change', payload: { value: 'hello' } });

    expect(internal.eventLog).toHaveLength(1);
    expect(internal.eventLog[0].nodeId).toBe('a');
    expect(internal.eventLog[0].type).toBe('value-change');
  });

  it('updates node value from payload', () => {
    const internal = createEmptySessionState('s', () => 5000);
    setupWithView(internal);

    recordIntent(internal, { nodeId: 'a', type: 'value-change', payload: { value: 'updated' } });

    expect(internal.currentData!.values['a']).toEqual({ value: 'updated' });
  });

  it('updates valueLineage with lastUpdated and lastInteractionId', () => {
    const internal = createEmptySessionState('s', () => 5000);
    setupWithView(internal);

    recordIntent(internal, { nodeId: 'a', type: 'value-change', payload: { value: 'hello' } });

    expect(internal.currentData!.valueLineage!['a']).toBeDefined();
    expect(internal.currentData!.valueLineage!['a'].lastUpdated).toBeDefined();
    expect(internal.currentData!.valueLineage!['a'].lastInteractionId).toBeDefined();
  });

  it('notifies snapshot listeners', () => {
    const internal = createEmptySessionState('s', () => 5000);
    setupWithView(internal);
    const listener = vi.fn();
    internal.snapshotListeners.add(listener);

    recordIntent(internal, { nodeId: 'a', type: 'value-change', payload: { value: 'hello' } });

    expect(listener).toHaveBeenCalledOnce();
  });

  it('does nothing when destroyed', () => {
    const internal = createEmptySessionState('s', () => 5000);
    setupWithView(internal);
    internal.destroyed = true;

    recordIntent(internal, { nodeId: 'a', type: 'value-change', payload: { value: 'hello' } });

    expect(internal.eventLog).toHaveLength(0);
  });

  it('does nothing when no data exists', () => {
    const internal = createEmptySessionState('s', () => 5000);

    recordIntent(internal, { nodeId: 'a', type: 'value-change', payload: { value: 'hello' } });

    expect(internal.eventLog).toHaveLength(0);
  });

  it('throws when interaction type is invalid', () => {
    const internal = createEmptySessionState('s', () => 5000);
    setupWithView(internal);

    expect(() => recordIntent(internal, {
      nodeId: 'a',
      type: 'invalid-type' as never,
      payload: { value: 'hello' },
    })).toThrow('Invalid interaction type');
  });
});
