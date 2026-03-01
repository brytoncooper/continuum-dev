import type { ViewDefinition, ViewNode } from '@continuum/contract';
import { describe, expect, it, vi } from 'vitest';
import { createSession, deserialize } from './session.js';

function makeNode(
  overrides: Partial<ViewNode> & { id: string; type?: ViewNode['type'] }
): ViewNode {
  const type = overrides.type ?? 'field';
  return {
    id: overrides.id,
    key: overrides.key,
    hash: overrides.hash,
    hidden: overrides.hidden,
    migrations: overrides.migrations,
    type,
    ...(type === 'field' ? { dataType: 'string' } : {}),
    ...(type === 'group' ? { children: [] as ViewNode[] } : {}),
    ...(type === 'action' ? { intentId: 'intent-1', label: 'Run' } : {}),
    ...(type === 'presentation' ? { contentType: 'text', content: '' } : {}),
    ...overrides,
  } as ViewNode;
}

const viewV1: ViewDefinition = {
  viewId: 'view',
  version: '1',
  nodes: [
    makeNode({ id: 'a', key: 'a' }),
    makeNode({ id: 'b', key: 'b' }),
  ],
};

const viewV2: ViewDefinition = {
  viewId: 'view',
  version: '2',
  nodes: [
    makeNode({ id: 'a2', key: 'a' }),
    makeNode({ id: 'b', key: 'b' }),
  ],
};

describe('session hardening', () => {
  it('stores manual checkpoints and allows rewind to them', () => {
    const session = createSession();
    session.pushView(viewV1);
    session.updateState('a', { value: 'one' });
    const checkpoint = session.checkpoint();
    session.updateState('a', { value: 'two' });

    expect(session.getCheckpoints().map((cp) => cp.checkpointId)).toContain(checkpoint.checkpointId);

    session.rewind(checkpoint.checkpointId);
    expect(session.getSnapshot()?.data.values.a).toEqual({ value: 'one' });
  });

  it('throws when manual checkpoint is created without a snapshot', () => {
    const session = createSession();
    expect(() => session.checkpoint()).toThrow('Cannot create checkpoint before pushing a view');
  });

  it('isolates listener failures so all listeners still receive updates', () => {
    const session = createSession();
    const snapshotSpy = vi.fn();
    session.onSnapshot(() => {
      throw new Error('listener failed');
    });
    session.onSnapshot(snapshotSpy);

    session.pushView(viewV1);
    expect(snapshotSpy).toHaveBeenCalledTimes(1);
  });

  it('updates the requested key and notifies snapshot listeners', () => {
    const session = createSession();
    const snapshots: Array<Record<string, unknown>> = [];
    session.onSnapshot((snapshot) => {
      snapshots.push(snapshot.data.values);
    });
    session.pushView(viewV1);
    session.updateState('a', { value: 'new-a' });

    const values = session.getSnapshot()?.data.values ?? {};
    expect(values.a).toEqual({ value: 'new-a' });
    expect(values.b).toBeUndefined();
    expect(snapshots.length).toBeGreaterThanOrEqual(2);
  });

  it('clears checkpoints, diffs, and resolutions on destroy and getters return empty values', () => {
    const session = createSession();
    session.pushView(viewV1);
    session.updateState('a', { value: 'value' });
    session.pushView(viewV2);
    session.checkpoint();

    session.destroy();

    expect(session.getSnapshot()).toBeNull();
    expect(session.getIssues()).toEqual([]);
    expect(session.getDiffs()).toEqual([]);
    expect(session.getResolutions()).toEqual([]);
    expect(session.getEventLog()).toEqual([]);
    expect(session.getPendingIntents()).toEqual([]);
    expect(session.getCheckpoints()).toEqual([]);
  });

  it('returns booleans for validateIntent and cancelIntent', () => {
    const session = createSession();
    session.pushView(viewV1);
    session.submitIntent({ nodeId: 'a', intentName: 'submit', payload: {} });
    const intent = session.getPendingIntents()[0];

    expect(session.validateIntent('missing')).toBe(false);
    expect(session.cancelIntent('missing')).toBe(false);
    expect(session.validateIntent(intent.intentId)).toBe(true);
    expect(session.cancelIntent(intent.intentId)).toBe(true);
  });

  it('validates view shape in pushView', () => {
    const session = createSession();
    expect(() =>
      session.pushView({ viewId: '', version: '1', nodes: [] } as ViewDefinition)
    ).toThrow('Invalid view: "viewId" must be a non-empty string');
    expect(() =>
      session.pushView({ viewId: 'x', version: '', nodes: [] } as ViewDefinition)
    ).toThrow('Invalid view: "version" must be a non-empty string');
    expect(() =>
      session.pushView({ viewId: 'x', version: '1', nodes: null } as unknown as ViewDefinition)
    ).toThrow('Invalid view: "nodes" must be an array');
  });

  it('serializes to a detached object that does not mutate internal state', () => {
    const session = createSession();
    session.pushView(viewV1);
    session.updateState('a', { value: 'safe' });
    const serialized = session.serialize() as {
      currentData: { values: Record<string, unknown> };
      eventLog: Array<{ type: string }>;
    };

    serialized.currentData.values.a = { value: 'mutated' };
    serialized.eventLog.push({ type: 'tampered' });

    expect(session.getSnapshot()?.data.values.a).toEqual({ value: 'safe' });
    expect(session.getEventLog().some((item) => item.type === 'tampered')).toBe(false);
  });

  it('supports full round-trip of snapshot, events, intents, and checkpoints', () => {
    const session = createSession();
    session.pushView(viewV1);
    session.updateState('a', { value: 'alpha' });
    session.submitIntent({ nodeId: 'a', intentName: 'submit', payload: { ok: true } });
    session.checkpoint();
    session.pushView(viewV2);
    const blob = session.serialize();

    const restored = deserialize(blob);
    expect(restored.getSnapshot()).toEqual(session.getSnapshot());
    expect(restored.getEventLog()).toEqual(session.getEventLog());
    expect(restored.getPendingIntents()).toEqual(session.getPendingIntents());
    expect(restored.getCheckpoints()).toEqual(session.getCheckpoints());
    expect(restored.getIssues()).toEqual(session.getIssues());
    expect(restored.getDiffs()).toEqual(session.getDiffs());
    expect(restored.getResolutions()).toEqual(session.getResolutions());
  });

  it('keeps checkpoint snapshots isolated from later mutations', () => {
    const session = createSession();
    session.pushView(viewV1);
    session.updateState('a', { value: 'at-checkpoint' });
    const checkpoint = session.checkpoint();
    session.updateState('a', { value: 'after-checkpoint' });
    const checkpoints = session.getCheckpoints();
    const persisted = checkpoints.find((cp) => cp.checkpointId === checkpoint.checkpointId);

    expect(persisted?.snapshot.data.values.a).toEqual({ value: 'at-checkpoint' });
  });

  it('clears issues, diffs, and resolutions when rewinding', () => {
    const session = createSession();
    session.pushView(viewV1);
    const checkpoint = session.checkpoint();
    session.pushView({
      viewId: 'view',
      version: '3',
      nodes: [makeNode({ id: 'a', key: 'a', type: 'action' })],
    });
    expect(session.getIssues().length).toBeGreaterThan(0);
    expect(session.getDiffs().length).toBeGreaterThan(0);
    expect(session.getResolutions().length).toBeGreaterThan(0);

    session.rewind(checkpoint.checkpointId);

    expect(session.getIssues()).toEqual([]);
    expect(session.getDiffs()).toEqual([]);
    expect(session.getResolutions()).toEqual([]);
  });

  it('honors maxEventLogSize and maxPendingIntents options', () => {
    const session = createSession({ maxEventLogSize: 2, maxPendingIntents: 2 });
    session.pushView(viewV1);
    session.updateState('a', { value: '1' });
    session.updateState('a', { value: '2' });
    session.updateState('a', { value: '3' });
    session.submitIntent({ nodeId: 'a', intentName: 'x', payload: { i: 1 } });
    session.submitIntent({ nodeId: 'a', intentName: 'x', payload: { i: 2 } });
    session.submitIntent({ nodeId: 'a', intentName: 'x', payload: { i: 3 } });

    expect(session.getEventLog()).toHaveLength(2);
    expect(session.getPendingIntents()).toHaveLength(2);
  });
});
