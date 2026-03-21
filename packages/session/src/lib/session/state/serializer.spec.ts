import type { DataSnapshot } from '@continuum-dev/contract';
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
    internal.eventLog = [{ interactionId: 'i1', sessionId: 's', nodeId: 'a', type: 'value-change', payload: {}, timestamp: 1, viewVersion: '1.0' }];

    const serialized = serializeSession(internal) as Record<string, unknown>;

    expect((serialized.eventLog as unknown[]).length).toBe(1);
  });

  it('preserves undefined node values before persistence encoding', () => {
    const internal = createEmptySessionState('s', () => 1000);
    internal.currentView = { viewId: 's1', version: '1.0', nodes: [] };
    internal.currentData = {
      values: { a: { value: undefined, isDirty: true, isSticky: true } },
      lineage: { timestamp: 1000, sessionId: 's' },
    };

    const serialized = serializeSession(internal) as {
      currentData: {
        values: Record<
          string,
          { value?: unknown; isDirty?: boolean; isSticky?: boolean }
        >;
      };
    };

    expect(serialized.currentData.values.a).toHaveProperty('value');
    expect(serialized.currentData.values.a.value).toBeUndefined();
    expect(serialized.currentData.values.a.isDirty).toBe(true);
    expect(serialized.currentData.values.a.isSticky).toBe(true);
  });

  it('preserves Date node values before persistence encoding', () => {
    const internal = createEmptySessionState('s', () => 1000);
    const createdAt = new Date('2026-03-01T00:00:00.000Z');
    internal.currentView = { viewId: 's1', version: '1.0', nodes: [] };
    internal.currentData = {
      values: { a: { value: createdAt } },
      lineage: { timestamp: 1000, sessionId: 's' },
    };

    const serialized = serializeSession(internal) as {
      currentData: { values: Record<string, { value?: unknown }> };
    };

    expect(serialized.currentData.values.a.value).toBeInstanceOf(Date);
    expect(serialized.currentData.values.a.value).toEqual(createdAt);
  });

  it('drops legacy viewContext from currentData before persistence encoding', () => {
    const internal = createEmptySessionState('s', () => 1000);
    internal.currentView = { viewId: 's1', version: '1.0', nodes: [] };
    internal.currentData = {
      values: { a: { value: 'hello' } },
      viewContext: { a: { scrollX: 12 } },
      lineage: { timestamp: 1000, sessionId: 's' },
    } as unknown as DataSnapshot;

    const serialized = serializeSession(internal) as {
      currentData: Record<string, unknown>;
    };

    expect('viewContext' in serialized.currentData).toBe(false);
  });

  it('drops legacy viewContext from checkpoint snapshots before persistence encoding', () => {
    const internal = createEmptySessionState('s', () => 1000);
    internal.currentView = { viewId: 's1', version: '1.0', nodes: [] };
    internal.checkpoints = [
      {
        checkpointId: 'cp-1',
        sessionId: 's',
        snapshot: {
          view: { viewId: 's1', version: '1.0', nodes: [] },
          data: {
            values: { a: { value: 'hello' } },
            viewContext: { a: { scrollX: 12 } },
            lineage: { timestamp: 1000, sessionId: 's' },
          } as unknown as DataSnapshot,
        },
        eventIndex: 0,
        timestamp: 1000,
        trigger: 'manual',
      },
    ];

    const serialized = serializeSession(internal) as {
      checkpoints: Array<{ snapshot: { data: Record<string, unknown> } }>;
    };

    expect('viewContext' in serialized.checkpoints[0].snapshot.data).toBe(false);
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

  it('strips legacy viewContext when deserializing', () => {
    const data = {
      sessionId: 's',
      currentView: { viewId: 's1', version: '1', nodes: [] },
      currentData: {
        values: {},
        viewContext: {
          chart: { scrollX: 5, scrollY: 15, zoom: 2, offsetX: 1, offsetY: 3 },
        },
        lineage: { timestamp: 1, sessionId: 's' },
      },
      priorView: null,
      eventLog: [],
      pendingIntents: [],
      checkpoints: [],
      issues: [],
      diffs: [],
      resolutions: [],
    };

    const restored = deserializeToState(data, () => 0);
    expect(restored.currentData).not.toBeNull();
    expect('viewContext' in (restored.currentData as object)).toBe(false);
  });

  it('strips legacy viewContext from checkpoint snapshots when deserializing', () => {
    const data = {
      sessionId: 's',
      currentView: { viewId: 's1', version: '1', nodes: [] },
      currentData: null,
      priorView: null,
      eventLog: [],
      pendingIntents: [],
      checkpoints: [
        {
          checkpointId: 'cp-1',
          sessionId: 's',
          snapshot: {
            view: { viewId: 's1', version: '1', nodes: [] },
            data: {
              values: {},
              viewContext: {
                chart: { scrollX: 5 },
              },
              lineage: { timestamp: 1, sessionId: 's' },
            },
          },
          eventIndex: 0,
          timestamp: 1,
          trigger: 'manual',
        },
      ],
      issues: [],
      diffs: [],
      resolutions: [],
    };

    const restored = deserializeToState(data, () => 0);

    expect('viewContext' in (restored.checkpoints[0].snapshot.data as object)).toBe(
      false
    );
  });

  it('drops focus when deserializing', () => {
    const internal = createEmptySessionState('s', () => 1000);
    internal.currentView = { viewId: 's1', version: '1.0', nodes: [] };
    internal.currentData = {
      values: { a: { value: 'hello' } },
      lineage: { timestamp: 1000, sessionId: 's' },
    };
    internal.focusedNodeId = 'a';

    const restored = deserializeToState(serializeSession(internal), () => 2000);

    expect(restored.focusedNodeId).toBeNull();
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

  it('throws when eventLog contains an invalid interaction type', () => {
    const bad = {
      sessionId: 's',
      currentView: null,
      currentData: null,
      priorView: null,
      eventLog: [{ interactionId: 'i1', sessionId: 's', nodeId: 'a', type: 'x', payload: {}, timestamp: 1, viewVersion: '1.0' }],
      pendingIntents: [],
      checkpoints: [],
      issues: [],
      diffs: [],
      resolutions: [],
    };

    expect(() => deserializeToState(bad, () => 0)).toThrow('eventLog[0].type');
  });

  it('trims arrays exceeding configured size limits', () => {
    const events = Array.from({ length: 10 }, (_, i) => ({
      interactionId: `i${i}`, sessionId: 's', nodeId: 'a',
      type: 'value-change', payload: {}, timestamp: i, viewVersion: '1.0',
    }));
    const data = {
      sessionId: 's', currentView: null, currentData: null, priorView: null,
      eventLog: events, pendingIntents: [], checkpoints: [],
      issues: [], diffs: [], resolutions: [],
    };

    const restored = deserializeToState(data, () => 0, {
      maxEventLogSize: 3, maxPendingIntents: 2, maxCheckpoints: 1,
    });

    expect(restored.eventLog.length).toBe(3);
    // Should keep the most recent (tail) entries
    expect(restored.eventLog[0].interactionId).toBe('i7');
    expect(restored.eventLog[2].interactionId).toBe('i9');
  });
});
