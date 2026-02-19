import { describe, it, expect, beforeEach } from 'vitest';
import type { SchemaSnapshot, ComponentDefinition } from '@continuum/contract';
import { createSession, deserialize } from './session.js';
import type { Session } from './types.js';

function makeSchema(
  components: ComponentDefinition[],
  id = 'schema-1',
  version = '1.0'
): SchemaSnapshot {
  return { schemaId: id, version, components };
}

function makeComponent(
  overrides: Partial<ComponentDefinition> & { id: string; type: string }
): ComponentDefinition {
  return { ...overrides };
}

describe('Session Ledger', () => {
  describe('lifecycle', () => {
    it('createSession returns a session with a unique sessionId', () => {
      const session = createSession();
      expect(session.sessionId).toBeDefined();
      expect(typeof session.sessionId).toBe('string');
      expect(session.sessionId.length).toBeGreaterThan(0);

      const session2 = createSession();
      expect(session2.sessionId).not.toBe(session.sessionId);
    });

    it('returns null snapshot before first schema push', () => {
      const session = createSession();
      expect(session.getSnapshot()).toBeNull();
    });

    it('returns empty issues before first schema push', () => {
      const session = createSession();
      expect(session.getIssues()).toEqual([]);
    });

    it('destroy clears snapshot, stops listeners, and ignores further pushes', () => {
      const session = createSession();
      const schema = makeSchema([makeComponent({ id: 'a', type: 'input' })]);
      session.pushSchema(schema);

      let snapshotCallCount = 0;
      session.onSnapshot(() => {
        snapshotCallCount++;
      });

      session.destroy();

      expect(session.getSnapshot()).toBeNull();

      session.pushSchema(schema);
      expect(snapshotCallCount).toBe(0);
    });

    it('destroy returns accumulated issues from last reconciliation', () => {
      const session = createSession();
      const schemaV1 = makeSchema(
        [makeComponent({ id: 'a', type: 'input' }), makeComponent({ id: 'b', type: 'toggle' })],
        'schema-1',
        '1.0'
      );
      session.pushSchema(schemaV1);
      session.updateState('a', { value: 'hello' });
      session.updateState('b', { checked: true });

      const schemaV2 = makeSchema(
        [makeComponent({ id: 'a', type: 'input' })],
        'schema-1',
        '2.0'
      );
      session.pushSchema(schemaV2);

      const issuesBefore = session.getIssues();
      expect(issuesBefore.length).toBeGreaterThan(0);

      const result = session.destroy();
      expect(result.issues).toEqual(issuesBefore);
    });
  });

  describe('schema management', () => {
    it('first pushSchema creates snapshot with empty state', () => {
      const session = createSession();
      const schema = makeSchema([makeComponent({ id: 'a', type: 'input' })]);

      session.pushSchema(schema);

      const snapshot = session.getSnapshot();
      expect(snapshot).not.toBeNull();
      expect(snapshot!.schema).toBe(schema);
      expect(snapshot!.state.values).toEqual({});
    });

    it('second pushSchema triggers reconciliation and preserves matching state', () => {
      const session = createSession();
      const schemaV1 = makeSchema(
        [makeComponent({ id: 'a', type: 'input' })],
        'schema-1',
        '1.0'
      );
      session.pushSchema(schemaV1);
      session.updateState('a', { value: 'hello' });

      const schemaV2 = makeSchema(
        [makeComponent({ id: 'a', type: 'input' })],
        'schema-1',
        '2.0'
      );
      session.pushSchema(schemaV2);

      const snapshot = session.getSnapshot();
      expect(snapshot!.state.values['a']).toEqual({ value: 'hello' });
      expect(snapshot!.state.meta.schemaVersion).toBe('2.0');
    });

    it('schema push notifies snapshot listeners', () => {
      const session = createSession();
      const snapshots: unknown[] = [];
      session.onSnapshot((s) => snapshots.push(s));

      const schema = makeSchema([makeComponent({ id: 'a', type: 'input' })]);
      session.pushSchema(schema);

      expect(snapshots).toHaveLength(1);
    });

    it('schema push notifies issue listeners', () => {
      const session = createSession();
      const issueUpdates: unknown[] = [];
      session.onIssues((i) => issueUpdates.push(i));

      const schema = makeSchema([makeComponent({ id: 'a', type: 'input' })]);
      session.pushSchema(schema);

      expect(issueUpdates).toHaveLength(1);
    });

    it('schema version tracked in state meta', () => {
      const session = createSession();
      const schema = makeSchema(
        [makeComponent({ id: 'a', type: 'input' })],
        'schema-1',
        '3.0'
      );

      session.pushSchema(schema);

      const snapshot = session.getSnapshot();
      expect(snapshot!.state.meta.schemaVersion).toBe('3.0');
    });
  });

  describe('intent capture', () => {
    let session: Session;
    const schema = makeSchema([makeComponent({ id: 'a', type: 'input' })]);

    beforeEach(() => {
      session = createSession();
      session.pushSchema(schema);
    });

    it('recordIntent adds interaction to the event log', () => {
      session.recordIntent({
        componentId: 'a',
        type: 'value-change',
        payload: { value: 'hello' },
      });

      const log = session.getEventLog();
      expect(log).toHaveLength(1);
      expect(log[0].componentId).toBe('a');
      expect(log[0].type).toBe('value-change');
      expect(log[0].payload).toEqual({ value: 'hello' });
    });

    it('getEventLog returns all recorded interactions in order', () => {
      session.recordIntent({
        componentId: 'a',
        type: 'value-change',
        payload: { value: 'first' },
      });
      session.recordIntent({
        componentId: 'a',
        type: 'value-change',
        payload: { value: 'second' },
      });

      const log = session.getEventLog();
      expect(log).toHaveLength(2);
      expect(log[0].payload).toEqual({ value: 'first' });
      expect(log[1].payload).toEqual({ value: 'second' });
    });

    it('recordIntent updates component state from payload', () => {
      session.recordIntent({
        componentId: 'a',
        type: 'value-change',
        payload: { value: 'updated' },
      });

      const snapshot = session.getSnapshot();
      expect(snapshot!.state.values['a']).toEqual({ value: 'updated' });
    });

    it('recordIntent sets lastInteractionId on state meta', () => {
      session.recordIntent({
        componentId: 'a',
        type: 'value-change',
        payload: { value: 'hello' },
      });

      const snapshot = session.getSnapshot();
      expect(snapshot!.state.meta.lastInteractionId).toBeDefined();
    });

    it('recordIntent sets valuesMeta for the component', () => {
      session.recordIntent({
        componentId: 'a',
        type: 'value-change',
        payload: { value: 'hello' },
      });

      const snapshot = session.getSnapshot();
      expect(snapshot!.state.valuesMeta).toBeDefined();
      expect(snapshot!.state.valuesMeta!['a']).toBeDefined();
      expect(snapshot!.state.valuesMeta!['a'].lastUpdated).toBeDefined();
      expect(snapshot!.state.valuesMeta!['a'].lastInteractionId).toBeDefined();
    });

    it('updateState is a convenience shorthand for recordIntent', () => {
      session.updateState('a', { value: 'shorthand' });

      const snapshot = session.getSnapshot();
      expect(snapshot!.state.values['a']).toEqual({ value: 'shorthand' });

      const log = session.getEventLog();
      expect(log).toHaveLength(1);
    });
  });

  describe('pending actions', () => {
    let session: Session;
    const schema = makeSchema(
      [makeComponent({ id: 'a', type: 'input' })],
      'schema-1',
      '1.0'
    );

    beforeEach(() => {
      session = createSession();
      session.pushSchema(schema);
    });

    it('submitAction adds a pending action with status pending', () => {
      session.submitAction({
        componentId: 'a',
        actionType: 'submit-form',
        payload: { value: 'data' },
      });

      const actions = session.getPendingActions();
      expect(actions).toHaveLength(1);
      expect(actions[0].status).toBe('pending');
      expect(actions[0].componentId).toBe('a');
      expect(actions[0].actionType).toBe('submit-form');
    });

    it('getPendingActions returns all pending actions', () => {
      session.submitAction({
        componentId: 'a',
        actionType: 'submit-form',
        payload: { value: 'data1' },
      });
      session.submitAction({
        componentId: 'a',
        actionType: 'submit-form',
        payload: { value: 'data2' },
      });

      const actions = session.getPendingActions();
      expect(actions).toHaveLength(2);
    });

    it('schema push marks pending actions as stale when schema version changes', () => {
      session.submitAction({
        componentId: 'a',
        actionType: 'submit-form',
        payload: { value: 'data' },
      });

      const schemaV2 = makeSchema(
        [makeComponent({ id: 'a', type: 'input' })],
        'schema-1',
        '2.0'
      );
      session.pushSchema(schemaV2);

      const actions = session.getPendingActions();
      expect(actions[0].status).toBe('stale');
    });

    it('validateAction transitions action from stale to validated', () => {
      session.submitAction({
        componentId: 'a',
        actionType: 'submit-form',
        payload: { value: 'data' },
      });

      const schemaV2 = makeSchema(
        [makeComponent({ id: 'a', type: 'input' })],
        'schema-1',
        '2.0'
      );
      session.pushSchema(schemaV2);

      const actionId = session.getPendingActions()[0].id;
      session.validateAction(actionId);

      expect(session.getPendingActions()[0].status).toBe('validated');
    });

    it('cancelAction transitions action to cancelled', () => {
      session.submitAction({
        componentId: 'a',
        actionType: 'submit-form',
        payload: { value: 'data' },
      });

      const actionId = session.getPendingActions()[0].id;
      session.cancelAction(actionId);

      expect(session.getPendingActions()[0].status).toBe('cancelled');
    });
  });

  describe('checkpointing', () => {
    let session: Session;
    const schema = makeSchema([makeComponent({ id: 'a', type: 'input' })]);

    beforeEach(() => {
      session = createSession();
      session.pushSchema(schema);
    });

    it('checkpoint returns a serializable checkpoint with snapshot and event index', () => {
      session.updateState('a', { value: 'hello' });
      session.updateState('a', { value: 'world' });

      const cp = session.checkpoint();

      expect(cp.id).toBeDefined();
      expect(cp.sessionId).toBe(session.sessionId);
      expect(cp.snapshot).toBeDefined();
      expect(cp.snapshot.state.values['a']).toEqual({ value: 'world' });
      expect(cp.eventIndex).toBe(2);
      expect(cp.timestamp).toBeDefined();
    });

    it('restoreFromCheckpoint rebuilds session state from checkpoint', () => {
      session.updateState('a', { value: 'hello' });
      session.updateState('a', { value: 'world' });
      const cp = session.checkpoint();

      session.updateState('a', { value: 'after-checkpoint' });

      session.restoreFromCheckpoint(cp);

      const snapshot = session.getSnapshot();
      expect(snapshot!.state.values['a']).toEqual({ value: 'world' });
    });

    it('restored session preserves event log up to checkpoint event index', () => {
      session.updateState('a', { value: 'first' });
      session.updateState('a', { value: 'second' });
      const cp = session.checkpoint();

      session.updateState('a', { value: 'third' });
      expect(session.getEventLog()).toHaveLength(3);

      session.restoreFromCheckpoint(cp);
      expect(session.getEventLog()).toHaveLength(2);
    });

    it('restored session can continue recording new intents', () => {
      session.updateState('a', { value: 'first' });
      const cp = session.checkpoint();

      session.restoreFromCheckpoint(cp);
      session.updateState('a', { value: 'after-restore' });

      const snapshot = session.getSnapshot();
      expect(snapshot!.state.values['a']).toEqual({ value: 'after-restore' });
      expect(session.getEventLog()).toHaveLength(2);
    });

    it('restoreFromCheckpoint notifies snapshot listeners', () => {
      session.updateState('a', { value: 'hello' });
      const cp = session.checkpoint();
      session.updateState('a', { value: 'after-checkpoint' });

      const snapshots: unknown[] = [];
      session.onSnapshot((s) => snapshots.push(s));

      session.restoreFromCheckpoint(cp);

      expect(snapshots).toHaveLength(1);
      expect(
        (snapshots[0] as { state: { values: Record<string, unknown> } }).state.values['a']
      ).toEqual({ value: 'hello' });
    });

    it('restoreFromCheckpoint notifies issue listeners', () => {
      session.updateState('a', { value: 'hello' });
      const cp = session.checkpoint();

      const issueUpdates: unknown[] = [];
      session.onIssues((i) => issueUpdates.push(i));

      session.restoreFromCheckpoint(cp);

      expect(issueUpdates).toHaveLength(1);
    });

    it('restoreFromCheckpoint clears diffs, issues, and trace', () => {
      const schemaV2 = makeSchema(
        [
          makeComponent({ id: 'a', type: 'input' }),
          makeComponent({ id: 'b', type: 'toggle' }),
        ],
        'schema-1',
        '2.0'
      );
      session.updateState('a', { value: 'hello' });
      const cp = session.checkpoint();

      session.pushSchema(schemaV2);
      expect(session.getDiffs().length).toBeGreaterThan(0);
      expect(session.getTrace().length).toBeGreaterThan(0);

      session.restoreFromCheckpoint(cp);

      expect(session.getDiffs()).toEqual([]);
      expect(session.getIssues()).toEqual([]);
      expect(session.getTrace()).toEqual([]);
    });

    it('restoreFromCheckpoint clears pending actions', () => {
      session.submitAction({
        componentId: 'a',
        actionType: 'submit-form',
        payload: { value: 'data' },
      });
      expect(session.getPendingActions()).toHaveLength(1);

      const cp = session.checkpoint();
      session.submitAction({
        componentId: 'a',
        actionType: 'submit-form',
        payload: { value: 'more-data' },
      });
      expect(session.getPendingActions()).toHaveLength(2);

      session.restoreFromCheckpoint(cp);

      expect(session.getPendingActions()).toEqual([]);
    });

    it('restoreFromCheckpoint sets priorSchema to null', () => {
      const schemaV2 = makeSchema(
        [makeComponent({ id: 'a', type: 'input' })],
        'schema-1',
        '2.0'
      );
      session.pushSchema(schemaV2);
      const cp = session.checkpoint();

      session.restoreFromCheckpoint(cp);

      session.pushSchema(
        makeSchema(
          [makeComponent({ id: 'a', type: 'input' })],
          'schema-1',
          '3.0'
        )
      );
      const issues = session.getIssues();
      const noPriorSchema = issues.find((i) => i.code === 'NO_PRIOR_SCHEMA');
      expect(noPriorSchema).toBeUndefined();
    });
  });

  describe('subscriptions', () => {
    it('onSnapshot returns unsubscribe function', () => {
      const session = createSession();
      const unsub = session.onSnapshot(() => {});
      expect(typeof unsub).toBe('function');
    });

    it('onIssues returns unsubscribe function', () => {
      const session = createSession();
      const unsub = session.onIssues(() => {});
      expect(typeof unsub).toBe('function');
    });

    it('multiple listeners supported', () => {
      const session = createSession();
      const calls1: unknown[] = [];
      const calls2: unknown[] = [];

      session.onSnapshot((s) => calls1.push(s));
      session.onSnapshot((s) => calls2.push(s));

      const schema = makeSchema([makeComponent({ id: 'a', type: 'input' })]);
      session.pushSchema(schema);

      expect(calls1).toHaveLength(1);
      expect(calls2).toHaveLength(1);
    });

    it('unsubscribed listeners stop receiving', () => {
      const session = createSession();
      const calls: unknown[] = [];

      const unsub = session.onSnapshot((s) => calls.push(s));
      const schema = makeSchema([makeComponent({ id: 'a', type: 'input' })]);
      session.pushSchema(schema);
      expect(calls).toHaveLength(1);

      unsub();
      session.pushSchema(
        makeSchema([makeComponent({ id: 'a', type: 'input' })], 'schema-1', '2.0')
      );
      expect(calls).toHaveLength(1);
    });
  });

  describe('determinism', () => {
    it('session accepts a clock option', () => {
      const clock = () => 42;
      const session = createSession({ clock });
      expect(session).toBeDefined();
    });

    it('all timestamps use the injected clock', () => {
      let time = 1000;
      const clock = () => time++;
      const session = createSession({ clock });

      const schema = makeSchema([makeComponent({ id: 'a', type: 'input' })]);
      session.pushSchema(schema);
      session.updateState('a', { value: 'hello' });

      const snapshot = session.getSnapshot();
      expect(snapshot!.state.meta.timestamp).toBeGreaterThanOrEqual(1000);
      expect(snapshot!.state.meta.timestamp).toBeLessThan(2000);
    });

    it('same event sequence + same clock = identical snapshot', () => {
      function buildSession() {
        let time = 1000;
        const s = createSession({ clock: () => time++ });
        const schema = makeSchema([makeComponent({ id: 'a', type: 'input' })]);
        s.pushSchema(schema);
        s.updateState('a', { value: 'hello' });
        s.updateState('a', { value: 'world' });
        return s;
      }

      const s1 = buildSession();
      const s2 = buildSession();

      expect(s1.getSnapshot()!.state.values).toEqual(
        s2.getSnapshot()!.state.values
      );
      expect(s1.getSnapshot()!.state.meta.timestamp).toBe(
        s2.getSnapshot()!.state.meta.timestamp
      );
    });
  });

  describe('reconciliation trace', () => {
    it('getTrace returns trace from the last reconciliation', () => {
      const session = createSession();
      const schemaV1 = makeSchema(
        [makeComponent({ id: 'a', type: 'input' })],
        'schema-1',
        '1.0'
      );
      session.pushSchema(schemaV1);
      session.updateState('a', { value: 'hello' });

      const schemaV2 = makeSchema(
        [
          makeComponent({ id: 'a', type: 'input' }),
          makeComponent({ id: 'b', type: 'toggle' }),
        ],
        'schema-1',
        '2.0'
      );
      session.pushSchema(schemaV2);

      const trace = session.getTrace();
      expect(trace).toBeDefined();
      expect(trace.length).toBeGreaterThanOrEqual(2);

      const entryA = trace.find((t) => t.componentId === 'a');
      expect(entryA).toBeDefined();
      expect(entryA!.action).toBe('carried');

      const entryB = trace.find((t) => t.componentId === 'b');
      expect(entryB).toBeDefined();
      expect(entryB!.action).toBe('added');
    });

    it('getTrace returns empty array before first schema push', () => {
      const session = createSession();
      expect(session.getTrace()).toEqual([]);
    });
  });

  describe('serialization', () => {
    it('serialize returns a JSON-serializable representation of the full ledger', () => {
      const session = createSession();
      const schema = makeSchema([makeComponent({ id: 'a', type: 'input' })]);
      session.pushSchema(schema);
      session.updateState('a', { value: 'hello' });

      const serialized = session.serialize();

      expect(() => JSON.stringify(serialized)).not.toThrow();
      expect(serialized).toBeDefined();
    });

    it('deserialize reconstructs a session from serialized data', () => {
      const session = createSession();
      const schema = makeSchema([makeComponent({ id: 'a', type: 'input' })]);
      session.pushSchema(schema);
      session.updateState('a', { value: 'hello' });

      const serialized = session.serialize();
      const restored = deserialize(serialized);

      expect(restored.sessionId).toBe(session.sessionId);
      expect(restored.getSnapshot()!.state.values['a']).toEqual({
        value: 'hello',
      });
    });

    it('round-trip serialize/deserialize produces identical snapshot', () => {
      const session = createSession();
      const schema = makeSchema([makeComponent({ id: 'a', type: 'input' })]);
      session.pushSchema(schema);
      session.updateState('a', { value: 'hello' });

      const serialized = session.serialize();
      const restored = deserialize(serialized);

      expect(restored.getSnapshot()).toEqual(session.getSnapshot());
    });
  });
});
