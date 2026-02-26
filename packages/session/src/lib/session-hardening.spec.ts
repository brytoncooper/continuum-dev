import type { SchemaSnapshot } from '@continuum/contract';
import { describe, expect, it, vi } from 'vitest';
import { createSession, deserialize } from './session.js';

const schemaV1: SchemaSnapshot = {
  schemaId: 'schema',
  version: '1',
  components: [
    { id: 'a', key: 'a', type: 'input' },
    { id: 'b', key: 'b', type: 'input' },
  ],
};

const schemaV2: SchemaSnapshot = {
  schemaId: 'schema',
  version: '2',
  components: [
    { id: 'a2', key: 'a', type: 'input' },
    { id: 'b', key: 'b', type: 'input' },
  ],
};

describe('session hardening', () => {
  it('stores manual checkpoints and allows rewind to them', () => {
    const session = createSession();
    session.pushSchema(schemaV1);
    session.updateState('a', { value: 'one' });
    const checkpoint = session.checkpoint();
    session.updateState('a', { value: 'two' });

    expect(session.getCheckpoints().map((cp) => cp.id)).toContain(checkpoint.id);

    session.rewind(checkpoint.id);
    expect(session.getSnapshot()?.state.values.a).toEqual({ value: 'one' });
  });

  it('throws when manual checkpoint is created without a snapshot', () => {
    const session = createSession();
    expect(() => session.checkpoint()).toThrow('Cannot create checkpoint before pushing a schema');
  });

  it('isolates listener failures so all listeners still receive updates', () => {
    const session = createSession();
    const snapshotSpy = vi.fn();
    session.onSnapshot(() => {
      throw new Error('listener failed');
    });
    session.onSnapshot(snapshotSpy);

    session.pushSchema(schemaV1);
    expect(snapshotSpy).toHaveBeenCalledTimes(1);
  });

  it('updates the requested key and notifies snapshot listeners', () => {
    const session = createSession();
    const snapshots: Array<Record<string, unknown>> = [];
    session.onSnapshot((snapshot) => {
      snapshots.push(snapshot.state.values);
    });
    session.pushSchema(schemaV1);
    session.updateState('a', { value: 'new-a' });

    const values = session.getSnapshot()?.state.values ?? {};
    expect(values.a).toEqual({ value: 'new-a' });
    expect(values.b).toBeUndefined();
    expect(snapshots.length).toBeGreaterThanOrEqual(2);
  });

  it('clears checkpoints, diffs, and trace on destroy and getters return empty values', () => {
    const session = createSession();
    session.pushSchema(schemaV1);
    session.updateState('a', { value: 'value' });
    session.pushSchema(schemaV2);
    session.checkpoint();

    session.destroy();

    expect(session.getSnapshot()).toBeNull();
    expect(session.getIssues()).toEqual([]);
    expect(session.getDiffs()).toEqual([]);
    expect(session.getTrace()).toEqual([]);
    expect(session.getEventLog()).toEqual([]);
    expect(session.getPendingActions()).toEqual([]);
    expect(session.getCheckpoints()).toEqual([]);
  });

  it('returns booleans for validateAction and cancelAction', () => {
    const session = createSession();
    session.pushSchema(schemaV1);
    session.submitAction({ componentId: 'a', actionType: 'submit', payload: {} });
    const action = session.getPendingActions()[0];

    expect(session.validateAction('missing')).toBe(false);
    expect(session.cancelAction('missing')).toBe(false);
    expect(session.validateAction(action.id)).toBe(true);
    expect(session.cancelAction(action.id)).toBe(true);
  });

  it('validates schema shape in pushSchema', () => {
    const session = createSession();
    expect(() =>
      session.pushSchema({ schemaId: '', version: '1', components: [] } as SchemaSnapshot)
    ).toThrow('Invalid schema: "schemaId" must be a non-empty string');
    expect(() =>
      session.pushSchema({ schemaId: 'x', version: '', components: [] } as SchemaSnapshot)
    ).toThrow('Invalid schema: "version" must be a non-empty string');
    expect(() =>
      session.pushSchema({ schemaId: 'x', version: '1', components: null } as unknown as SchemaSnapshot)
    ).toThrow('Invalid schema: "components" must be an array');
  });

  it('serializes to a detached object that does not mutate internal state', () => {
    const session = createSession();
    session.pushSchema(schemaV1);
    session.updateState('a', { value: 'safe' });
    const serialized = session.serialize() as {
      currentState: { values: Record<string, unknown> };
      eventLog: Array<{ type: string }>;
    };

    serialized.currentState.values.a = { value: 'mutated' };
    serialized.eventLog.push({ type: 'tampered' });

    expect(session.getSnapshot()?.state.values.a).toEqual({ value: 'safe' });
    expect(session.getEventLog().some((item) => item.type === 'tampered')).toBe(false);
  });

  it('supports full round-trip of snapshot, events, actions, and checkpoints', () => {
    const session = createSession();
    session.pushSchema(schemaV1);
    session.updateState('a', { value: 'alpha' });
    session.submitAction({ componentId: 'a', actionType: 'submit', payload: { ok: true } });
    session.checkpoint();
    session.pushSchema(schemaV2);
    const blob = session.serialize();

    const restored = deserialize(blob);
    expect(restored.getSnapshot()).toEqual(session.getSnapshot());
    expect(restored.getEventLog()).toEqual(session.getEventLog());
    expect(restored.getPendingActions()).toEqual(session.getPendingActions());
    expect(restored.getCheckpoints()).toEqual(session.getCheckpoints());
    expect(restored.getIssues()).toEqual(session.getIssues());
    expect(restored.getDiffs()).toEqual(session.getDiffs());
    expect(restored.getTrace()).toEqual(session.getTrace());
  });

  it('keeps checkpoint snapshots isolated from later mutations', () => {
    const session = createSession();
    session.pushSchema(schemaV1);
    session.updateState('a', { value: 'at-checkpoint' });
    const checkpoint = session.checkpoint();
    session.updateState('a', { value: 'after-checkpoint' });
    const checkpoints = session.getCheckpoints();
    const persisted = checkpoints.find((cp) => cp.id === checkpoint.id);

    expect(persisted?.snapshot.state.values.a).toEqual({ value: 'at-checkpoint' });
  });

  it('clears issues, diffs, and trace when rewinding', () => {
    const session = createSession();
    session.pushSchema(schemaV1);
    const checkpoint = session.checkpoint();
    session.pushSchema({
      schemaId: 'schema',
      version: '3',
      components: [{ id: 'a', key: 'a', type: 'toggle' }],
    });
    expect(session.getIssues().length).toBeGreaterThan(0);
    expect(session.getDiffs().length).toBeGreaterThan(0);
    expect(session.getTrace().length).toBeGreaterThan(0);

    session.rewind(checkpoint.id);

    expect(session.getIssues()).toEqual([]);
    expect(session.getDiffs()).toEqual([]);
    expect(session.getTrace()).toEqual([]);
  });

  it('honors maxEventLogSize and maxPendingActions options', () => {
    const session = createSession({ maxEventLogSize: 2, maxPendingActions: 2 });
    session.pushSchema(schemaV1);
    session.updateState('a', { value: '1' });
    session.updateState('a', { value: '2' });
    session.updateState('a', { value: '3' });
    session.submitAction({ componentId: 'a', actionType: 'x', payload: { i: 1 } });
    session.submitAction({ componentId: 'a', actionType: 'x', payload: { i: 2 } });
    session.submitAction({ componentId: 'a', actionType: 'x', payload: { i: 3 } });

    expect(session.getEventLog()).toHaveLength(2);
    expect(session.getPendingActions()).toHaveLength(2);
  });
});
