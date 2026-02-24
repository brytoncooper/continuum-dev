import { describe, it, expect, vi } from 'vitest';
import { createInitialState } from './session-state.js';
import { recordIntent } from './event-log.js';

function setupWithSchema(internal: ReturnType<typeof createInitialState>) {
  internal.currentSchema = { schemaId: 's1', version: '1.0', components: [{ id: 'a', type: 'input' }] };
  internal.currentState = { values: {}, meta: { timestamp: 1000, sessionId: 's' } };
}

describe('recordIntent', () => {
  it('adds an interaction to the event log', () => {
    const internal = createInitialState('s', () => 5000);
    setupWithSchema(internal);

    recordIntent(internal, { componentId: 'a', type: 'value-change', payload: { value: 'hello' } });

    expect(internal.eventLog).toHaveLength(1);
    expect(internal.eventLog[0].componentId).toBe('a');
    expect(internal.eventLog[0].type).toBe('value-change');
  });

  it('updates component state from payload', () => {
    const internal = createInitialState('s', () => 5000);
    setupWithSchema(internal);

    recordIntent(internal, { componentId: 'a', type: 'value-change', payload: { value: 'updated' } });

    expect(internal.currentState!.values['a']).toEqual({ value: 'updated' });
  });

  it('updates valuesMeta with lastUpdated and lastInteractionId', () => {
    const internal = createInitialState('s', () => 5000);
    setupWithSchema(internal);

    recordIntent(internal, { componentId: 'a', type: 'value-change', payload: { value: 'hello' } });

    expect(internal.currentState!.valuesMeta!['a']).toBeDefined();
    expect(internal.currentState!.valuesMeta!['a'].lastUpdated).toBeDefined();
    expect(internal.currentState!.valuesMeta!['a'].lastInteractionId).toBeDefined();
  });

  it('notifies snapshot listeners', () => {
    const internal = createInitialState('s', () => 5000);
    setupWithSchema(internal);
    const listener = vi.fn();
    internal.snapshotListeners.add(listener);

    recordIntent(internal, { componentId: 'a', type: 'value-change', payload: { value: 'hello' } });

    expect(listener).toHaveBeenCalledOnce();
  });

  it('does nothing when destroyed', () => {
    const internal = createInitialState('s', () => 5000);
    setupWithSchema(internal);
    internal.destroyed = true;

    recordIntent(internal, { componentId: 'a', type: 'value-change', payload: { value: 'hello' } });

    expect(internal.eventLog).toHaveLength(0);
  });

  it('does nothing when no state exists', () => {
    const internal = createInitialState('s', () => 5000);

    recordIntent(internal, { componentId: 'a', type: 'value-change', payload: { value: 'hello' } });

    expect(internal.eventLog).toHaveLength(0);
  });
});
