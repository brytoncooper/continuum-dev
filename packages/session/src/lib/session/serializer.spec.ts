import { describe, it, expect } from 'vitest';
import { createEmptySessionState } from './session-state.js';
import { serializeSession, deserializeToState } from './serializer.js';

describe('serializeSession', () => {
  it('returns a JSON-serializable object with formatVersion', () => {
    const internal = createEmptySessionState('my-session', () => 1000);
    internal.currentView = { viewId: 's1', version: '1.0', nodes: [] };
    internal.currentData = { values: { a: { value: 'hello' } }, lineage: { timestamp: 1000, sessionId: 'my-session' } };

    const serialized = serializeSession(internal) as Record<string, unknown>;

    expect(() => JSON.stringify(serialized)).not.toThrow();
    expect(serialized.formatVersion).toBe(1);
    expect(serialized.sessionId).toBe('my-session');
  });

  it('includes all session data', () => {
    const internal = createEmptySessionState('s', () => 1000);
    internal.currentView = { viewId: 's1', version: '1.0', nodes: [] };
    internal.eventLog = [{ interactionId: 'i1', sessionId: 's', nodeId: 'a', type: 'x', payload: {}, timestamp: 1, viewVersion: '1.0' }];

    const serialized = serializeSession(internal) as Record<string, unknown>;

    expect((serialized.eventLog as unknown[]).length).toBe(1);
  });
});

describe('deserializeToState', () => {
  it('reconstructs SessionState from serialized data', () => {
    const internal = createEmptySessionState('s', () => 1000);
    internal.currentView = { viewId: 's1', version: '1.0', nodes: [] };
    internal.currentData = { values: { a: { value: 'hello' } }, lineage: { timestamp: 1000, sessionId: 's' } };
    const serialized = serializeSession(internal);

    const restored = deserializeToState(serialized, () => 2000);

    expect(restored.sessionId).toBe('s');
    expect(restored.currentData!.values['a']).toEqual({ value: 'hello' });
    expect(restored.clock()).toBe(2000);
    expect(restored.snapshotListeners.size).toBe(0);
    expect(restored.destroyed).toBe(false);
  });

  it('throws when format version is too high', () => {
    const data = { formatVersion: 999, sessionId: 's', currentView: null, currentData: null, priorView: null, eventLog: [], pendingIntents: [], checkpoints: [], issues: [], diffs: [], resolutions: [] };

    expect(() => deserializeToState(data, () => 0)).toThrow('Unsupported format version');
  });

  it('accepts data without formatVersion (legacy)', () => {
    const data = { sessionId: 's', currentView: null, currentData: null, priorView: null, eventLog: [], pendingIntents: [], checkpoints: [], issues: [], diffs: [], resolutions: [] };

    const restored = deserializeToState(data, () => 0);

    expect(restored.sessionId).toBe('s');
  });

  it('defaults missing arrays to empty', () => {
    const data = { sessionId: 's', currentView: null, currentData: null, priorView: null };

    const restored = deserializeToState(data, () => 0);

    expect(restored.eventLog).toEqual([]);
    expect(restored.pendingIntents).toEqual([]);
    expect(restored.checkpoints).toEqual([]);
    expect(restored.issues).toEqual([]);
  });

  it('throws when payload is not an object', () => {
    expect(() => deserializeToState('bad', () => 0)).toThrow('Invalid serialized session');
  });

  it('throws when sessionId is missing or not a string', () => {
    expect(() => deserializeToState({}, () => 0)).toThrow('sessionId');
    expect(() => deserializeToState({ sessionId: 1 }, () => 0)).toThrow('sessionId');
  });

  it('throws when collection fields are not arrays', () => {
    const bad = {
      sessionId: 's',
      currentView: null,
      currentData: null,
      priorView: null,
      eventLog: {},
    };

    expect(() => deserializeToState(bad, () => 0)).toThrow('eventLog');
  });
});
