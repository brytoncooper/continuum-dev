import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ViewDefinition, ViewNode } from '@continuum/contract';
import { createSession, deserialize } from './session.js';
import type { Session } from './types.js';

function makeView(
  nodes: ViewNode[],
  viewId = 'view-1',
  version = '1.0'
): ViewDefinition {
  return { viewId, version, nodes };
}

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

    it('returns null snapshot before first view push', () => {
      const session = createSession();
      expect(session.getSnapshot()).toBeNull();
    });

    it('returns empty issues before first view push', () => {
      const session = createSession();
      expect(session.getIssues()).toEqual([]);
    });

    it('destroy marks session destroyed and blocks further access', () => {
      const session = createSession();
      const view = makeView([makeNode({ id: 'a' })]);
      session.pushView(view);

      let snapshotCallCount = 0;
      session.onSnapshot(() => {
        snapshotCallCount++;
      });

      session.destroy();

      expect(session.isDestroyed).toBe(true);
      expect(() => session.getSnapshot()).toThrow('Session has been destroyed');
      expect(() => session.pushView(view)).toThrow('Session has been destroyed');
      expect(snapshotCallCount).toBe(0);
    });

    it('destroy returns accumulated issues from last reconciliation', () => {
      const session = createSession();
      const viewV1 = makeView(
        [makeNode({ id: 'a' }), makeNode({ id: 'b', type: 'action' })],
        'view-1',
        '1.0'
      );
      session.pushView(viewV1);
      session.updateState('a', { value: 'hello' });
      session.updateState('b', { checked: true });

      const viewV2 = makeView(
        [makeNode({ id: 'a' })],
        'view-1',
        '2.0'
      );
      session.pushView(viewV2);

      const issuesBefore = session.getIssues();
      expect(issuesBefore.length).toBeGreaterThan(0);

      const result = session.destroy();
      expect(result.issues).toEqual(issuesBefore);
    });

    it('reset clears session data and allows continued usage', () => {
      const session = createSession();
      session.pushView(makeView([makeNode({ id: 'a' })], 's1', '1'));
      session.updateState('a', { value: 'typed' });
      session.submitIntent({
        nodeId: 'a',
        intentName: 'submit-form',
        payload: { value: 'typed' },
      });

      expect(session.getSnapshot()).not.toBeNull();
      expect(session.getEventLog()).toHaveLength(1);
      expect(session.getPendingIntents()).toHaveLength(1);
      expect(session.getCheckpoints()).toHaveLength(1);

      session.reset();

      expect(session.getSnapshot()).toBeNull();
      expect(session.getEventLog()).toHaveLength(0);
      expect(session.getPendingIntents()).toHaveLength(0);
      expect(session.getCheckpoints()).toHaveLength(0);
      expect(session.getIssues()).toEqual([]);
      expect(session.getDiffs()).toEqual([]);
      expect(session.getResolutions()).toEqual([]);

      session.pushView(makeView([makeNode({ id: 'b' })], 's2', '1'));
      expect(session.getSnapshot()!.view.viewId).toBe('s2');
      expect(session.getCheckpoints()).toHaveLength(1);
    });
  });

  describe('view management', () => {
    it('first pushView creates snapshot with empty data', () => {
      const session = createSession();
      const view = makeView([makeNode({ id: 'a' })]);

      session.pushView(view);

      const snapshot = session.getSnapshot();
      expect(snapshot).not.toBeNull();
      expect(snapshot!.view).toEqual(view);
      expect(snapshot!.data.values).toEqual({});
    });

    it('second pushView triggers reconciliation and preserves matching data', () => {
      const session = createSession();
      const viewV1 = makeView(
        [makeNode({ id: 'a' })],
        'view-1',
        '1.0'
      );
      session.pushView(viewV1);
      session.updateState('a', { value: 'hello' });

      const viewV2 = makeView(
        [makeNode({ id: 'a' })],
        'view-1',
        '2.0'
      );
      session.pushView(viewV2);

      const snapshot = session.getSnapshot();
      expect(snapshot!.data.values['a']).toEqual({ value: 'hello' });
      expect(snapshot!.data.lineage.viewVersion).toBe('2.0');
    });

    it('view push notifies snapshot listeners', () => {
      const session = createSession();
      const snapshots: unknown[] = [];
      session.onSnapshot((s) => snapshots.push(s));

      const view = makeView([makeNode({ id: 'a' })]);
      session.pushView(view);

      expect(snapshots).toHaveLength(1);
    });

    it('view push notifies issue listeners', () => {
      const session = createSession();
      const issueUpdates: unknown[] = [];
      session.onIssues((i) => issueUpdates.push(i));

      const view = makeView([makeNode({ id: 'a' })]);
      session.pushView(view);

      expect(issueUpdates).toHaveLength(1);
    });

    it('view version tracked in data lineage', () => {
      const session = createSession();
      const view = makeView(
        [makeNode({ id: 'a' })],
        'view-1',
        '3.0'
      );

      session.pushView(view);

      const snapshot = session.getSnapshot();
      expect(snapshot!.data.lineage.viewVersion).toBe('3.0');
    });

    it('exposes detached values after node removal', () => {
      const session = createSession();
      const viewV1 = makeView(
        [
          makeNode({ id: 'a', key: 'a' }),
          makeNode({ id: 'b', key: 'b' }),
        ],
        'view-1',
        '1.0'
      );
      const viewV2 = makeView(
        [makeNode({ id: 'a', key: 'a' })],
        'view-1',
        '2.0'
      );
      session.pushView(viewV1);
      session.updateState('b', { value: 'keep me' });

      session.pushView(viewV2);

      expect(session.getDetachedValues()['b']).toBeDefined();
      expect(session.getDetachedValues()['b'].reason).toBe('node-removed');
    });
  });

  describe('intent capture', () => {
    let session: Session;
    const view = makeView([makeNode({ id: 'a' })]);

    beforeEach(() => {
      session = createSession();
      session.pushView(view);
    });

    it('recordIntent adds interaction to the event log', () => {
      session.recordIntent({
        nodeId: 'a',
        type: 'value-change',
        payload: { value: 'hello' },
      });

      const log = session.getEventLog();
      expect(log).toHaveLength(1);
      expect(log[0].nodeId).toBe('a');
      expect(log[0].type).toBe('value-change');
      expect(log[0].payload).toEqual({ value: 'hello' });
    });

    it('getEventLog returns all recorded interactions in order', () => {
      session.recordIntent({
        nodeId: 'a',
        type: 'value-change',
        payload: { value: 'first' },
      });
      session.recordIntent({
        nodeId: 'a',
        type: 'value-change',
        payload: { value: 'second' },
      });

      const log = session.getEventLog();
      expect(log).toHaveLength(2);
      expect(log[0].payload).toEqual({ value: 'first' });
      expect(log[1].payload).toEqual({ value: 'second' });
    });

    it('recordIntent updates node value from payload', () => {
      session.recordIntent({
        nodeId: 'a',
        type: 'value-change',
        payload: { value: 'updated' },
      });

      const snapshot = session.getSnapshot();
      expect(snapshot!.data.values['a']).toEqual({ value: 'updated' });
    });

    it('recordIntent sets lastInteractionId on data lineage', () => {
      session.recordIntent({
        nodeId: 'a',
        type: 'value-change',
        payload: { value: 'hello' },
      });

      const snapshot = session.getSnapshot();
      expect(snapshot!.data.lineage.lastInteractionId).toBeDefined();
    });

    it('recordIntent sets valueLineage for the node', () => {
      session.recordIntent({
        nodeId: 'a',
        type: 'value-change',
        payload: { value: 'hello' },
      });

      const snapshot = session.getSnapshot();
      expect(snapshot!.data.valueLineage).toBeDefined();
      expect(snapshot!.data.valueLineage!['a']).toBeDefined();
      expect(snapshot!.data.valueLineage!['a'].lastUpdated).toBeDefined();
      expect(snapshot!.data.valueLineage!['a'].lastInteractionId).toBeDefined();
    });

    it('updateState is a convenience shorthand for recordIntent', () => {
      session.updateState('a', { value: 'shorthand' });

      const snapshot = session.getSnapshot();
      expect(snapshot!.data.values['a']).toEqual({ value: 'shorthand' });

      const log = session.getEventLog();
      expect(log).toHaveLength(1);
    });

    it('stores and reads viewport state by node id', () => {
      session.updateViewportState('a', {
        scrollX: 10,
        scrollY: 20,
        zoom: 1.5,
        offsetX: 2,
        offsetY: 3,
      });

      expect(session.getViewportState('a')).toEqual({
        scrollX: 10,
        scrollY: 20,
        zoom: 1.5,
        offsetX: 2,
        offsetY: 3,
      });
      expect(session.getSnapshot()?.data.viewContext?.['a']).toEqual({
        scrollX: 10,
        scrollY: 20,
        zoom: 1.5,
        offsetX: 2,
        offsetY: 3,
      });
    });
  });

  describe('pending intents', () => {
    let session: Session;
    const view = makeView(
      [makeNode({ id: 'a' })],
      'view-1',
      '1.0'
    );

    beforeEach(() => {
      session = createSession();
      session.pushView(view);
    });

    it('submitIntent adds a pending intent with status pending', () => {
      session.submitIntent({
        nodeId: 'a',
        intentName: 'submit-form',
        payload: { value: 'data' },
      });

      const intents = session.getPendingIntents();
      expect(intents).toHaveLength(1);
      expect(intents[0].status).toBe('pending');
      expect(intents[0].nodeId).toBe('a');
      expect(intents[0].intentName).toBe('submit-form');
    });

    it('getPendingIntents returns all pending intents', () => {
      session.submitIntent({
        nodeId: 'a',
        intentName: 'submit-form',
        payload: { value: 'data1' },
      });
      session.submitIntent({
        nodeId: 'a',
        intentName: 'submit-form',
        payload: { value: 'data2' },
      });

      const intents = session.getPendingIntents();
      expect(intents).toHaveLength(2);
    });

    it('view push marks pending intents as stale when view version changes', () => {
      session.submitIntent({
        nodeId: 'a',
        intentName: 'submit-form',
        payload: { value: 'data' },
      });

      const viewV2 = makeView(
        [makeNode({ id: 'a' })],
        'view-1',
        '2.0'
      );
      session.pushView(viewV2);

      const intents = session.getPendingIntents();
      expect(intents[0].status).toBe('stale');
    });

    it('validateIntent transitions intent from stale to validated', () => {
      session.submitIntent({
        nodeId: 'a',
        intentName: 'submit-form',
        payload: { value: 'data' },
      });

      const viewV2 = makeView(
        [makeNode({ id: 'a' })],
        'view-1',
        '2.0'
      );
      session.pushView(viewV2);

      const intentId = session.getPendingIntents()[0].intentId;
      session.validateIntent(intentId);

      expect(session.getPendingIntents()[0].status).toBe('validated');
    });

    it('cancelIntent transitions intent to cancelled', () => {
      session.submitIntent({
        nodeId: 'a',
        intentName: 'submit-form',
        payload: { value: 'data' },
      });

      const intentId = session.getPendingIntents()[0].intentId;
      session.cancelIntent(intentId);

      expect(session.getPendingIntents()[0].status).toBe('cancelled');
    });
  });

  describe('pending proposals', () => {
    let session: Session;
    const view = makeView(
      [makeNode({ id: 'a' })],
      'view-1',
      '1.0'
    );

    beforeEach(() => {
      session = createSession();
      session.pushView(view);
    });

    it('proposeValue applies immediately when existing value is not dirty', () => {
      session.proposeValue('a', { value: 'ai-next' }, 'ai');

      expect(session.getSnapshot()?.data.values['a']).toEqual({ value: 'ai-next' });
      expect(session.getPendingProposals()).toEqual({});
    });

    it('proposeValue creates a pending proposal when existing value is dirty', () => {
      session.updateState('a', { value: 'typed', isDirty: true });

      session.proposeValue('a', { value: 'ai-next' }, 'ai');

      const proposal = session.getPendingProposals()['a'];
      expect(proposal).toBeDefined();
      expect(proposal?.proposedValue).toEqual({ value: 'ai-next' });
      expect(proposal?.currentValue).toEqual({ value: 'typed', isDirty: true });
      expect(proposal?.source).toBe('ai');
      expect(session.getSnapshot()?.data.values['a']).toEqual({ value: 'typed', isDirty: true });
    });

    it('acceptProposal applies proposed value and clears proposal', () => {
      session.updateState('a', { value: 'typed', isDirty: true });
      session.proposeValue('a', { value: 'ai-next' }, 'ai');

      session.acceptProposal('a');

      expect(session.getSnapshot()?.data.values['a']).toEqual({ value: 'ai-next', isDirty: true });
      expect(session.getPendingProposals()).toEqual({});
    });

    it('rejectProposal keeps existing value and clears proposal', () => {
      session.updateState('a', { value: 'typed', isDirty: true });
      session.proposeValue('a', { value: 'ai-next' }, 'ai');

      session.rejectProposal('a');

      expect(session.getSnapshot()?.data.values['a']).toEqual({ value: 'typed', isDirty: true });
      expect(session.getPendingProposals()).toEqual({});
    });
  });

  describe('checkpointing', () => {
    let session: Session;
    const view = makeView([makeNode({ id: 'a' })]);

    beforeEach(() => {
      session = createSession();
      session.pushView(view);
    });

    it('checkpoint returns a serializable checkpoint with snapshot and event index', () => {
      session.updateState('a', { value: 'hello' });
      session.updateState('a', { value: 'world' });

      const cp = session.checkpoint();

      expect(cp.checkpointId).toBeDefined();
      expect(cp.sessionId).toBe(session.sessionId);
      expect(cp.snapshot).toBeDefined();
      expect(cp.snapshot.data.values['a']).toEqual({ value: 'world' });
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
      expect(snapshot!.data.values['a']).toEqual({ value: 'world' });
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
      expect(snapshot!.data.values['a']).toEqual({ value: 'after-restore' });
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
        (snapshots[0] as { data: { values: Record<string, unknown> } }).data.values['a']
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

    it('restoreFromCheckpoint clears diffs, issues, and resolutions', () => {
      const viewV2 = makeView(
        [
          makeNode({ id: 'a' }),
          makeNode({ id: 'b', type: 'action' }),
        ],
        'view-1',
        '2.0'
      );
      session.updateState('a', { value: 'hello' });
      const cp = session.checkpoint();

      session.pushView(viewV2);
      expect(session.getDiffs().length).toBeGreaterThan(0);
      expect(session.getResolutions().length).toBeGreaterThan(0);

      session.restoreFromCheckpoint(cp);

      expect(session.getDiffs()).toEqual([]);
      expect(session.getIssues()).toEqual([]);
      expect(session.getResolutions()).toEqual([]);
    });

    it('restoreFromCheckpoint clears pending intents', () => {
      session.submitIntent({
        nodeId: 'a',
        intentName: 'submit-form',
        payload: { value: 'data' },
      });
      expect(session.getPendingIntents()).toHaveLength(1);

      const cp = session.checkpoint();
      session.submitIntent({
        nodeId: 'a',
        intentName: 'submit-form',
        payload: { value: 'more-data' },
      });
      expect(session.getPendingIntents()).toHaveLength(2);

      session.restoreFromCheckpoint(cp);

      expect(session.getPendingIntents()).toEqual([]);
    });

    it('restoreFromCheckpoint sets priorView to null', () => {
      const viewV2 = makeView(
        [makeNode({ id: 'a' })],
        'view-1',
        '2.0'
      );
      session.pushView(viewV2);
      const cp = session.checkpoint();

      session.restoreFromCheckpoint(cp);

      session.pushView(
        makeView(
          [makeNode({ id: 'a' })],
          'view-1',
          '3.0'
        )
      );
      const issues = session.getIssues();
      const noPriorView = issues.find((i) => i.code === 'NO_PRIOR_VIEW');
      expect(noPriorView).toBeUndefined();
    });
  });

  describe('subscriptions', () => {
    it('onSnapshot returns unsubscribe function', () => {
      const session = createSession();
      const unsub = session.onSnapshot(() => undefined);
      expect(typeof unsub).toBe('function');
    });

    it('onIssues returns unsubscribe function', () => {
      const session = createSession();
      const unsub = session.onIssues(() => undefined);
      expect(typeof unsub).toBe('function');
    });

    it('multiple listeners supported', () => {
      const session = createSession();
      const calls1: unknown[] = [];
      const calls2: unknown[] = [];

      session.onSnapshot((s) => calls1.push(s));
      session.onSnapshot((s) => calls2.push(s));

      const view = makeView([makeNode({ id: 'a' })]);
      session.pushView(view);

      expect(calls1).toHaveLength(1);
      expect(calls2).toHaveLength(1);
    });

    it('unsubscribed listeners stop receiving', () => {
      const session = createSession();
      const calls: unknown[] = [];

      const unsub = session.onSnapshot((s) => calls.push(s));
      const view = makeView([makeNode({ id: 'a' })]);
      session.pushView(view);
      expect(calls).toHaveLength(1);

      unsub();
      session.pushView(
        makeView([makeNode({ id: 'a' })], 'view-1', '2.0')
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

      const view = makeView([makeNode({ id: 'a' })]);
      session.pushView(view);
      session.updateState('a', { value: 'hello' });

      const snapshot = session.getSnapshot();
      expect(snapshot!.data.lineage.timestamp).toBeGreaterThanOrEqual(1000);
      expect(snapshot!.data.lineage.timestamp).toBeLessThan(2000);
    });

    it('same event sequence + same clock = identical snapshot', () => {
      function buildSession() {
        let time = 1000;
        const s = createSession({ clock: () => time++ });
        const view = makeView([makeNode({ id: 'a' })]);
        s.pushView(view);
        s.updateState('a', { value: 'hello' });
        s.updateState('a', { value: 'world' });
        return s;
      }

      const s1 = buildSession();
      const s2 = buildSession();

      expect(s1.getSnapshot()!.data.values).toEqual(
        s2.getSnapshot()!.data.values
      );
      expect(s1.getSnapshot()!.data.lineage.timestamp).toBe(
        s2.getSnapshot()!.data.lineage.timestamp
      );
    });
  });

  describe('reconciliation resolutions', () => {
    it('getResolutions returns resolutions from the last reconciliation', () => {
      const session = createSession();
      const viewV1 = makeView(
        [makeNode({ id: 'a' })],
        'view-1',
        '1.0'
      );
      session.pushView(viewV1);
      session.updateState('a', { value: 'hello' });

      const viewV2 = makeView(
        [
          makeNode({ id: 'a' }),
          makeNode({ id: 'b', type: 'action' }),
        ],
        'view-1',
        '2.0'
      );
      session.pushView(viewV2);

      const resolutions = session.getResolutions();
      expect(resolutions).toBeDefined();
      expect(resolutions.length).toBeGreaterThanOrEqual(2);

      const entryA = resolutions.find((r) => r.nodeId === 'a');
      expect(entryA).toBeDefined();
      expect(entryA!.resolution).toBe('carried');

      const entryB = resolutions.find((r) => r.nodeId === 'b');
      expect(entryB).toBeDefined();
      expect(entryB!.resolution).toBe('added');
    });

    it('getResolutions returns empty array before first view push', () => {
      const session = createSession();
      expect(session.getResolutions()).toEqual([]);
    });
  });

  describe('serialization', () => {
    it('serialize returns a JSON-serializable representation of the full ledger', () => {
      const session = createSession();
      const view = makeView([makeNode({ id: 'a' })]);
      session.pushView(view);
      session.updateState('a', { value: 'hello' });

      const serialized = session.serialize();

      expect(() => JSON.stringify(serialized)).not.toThrow();
      expect(serialized).toBeDefined();
    });

    it('deserialize reconstructs a session from serialized data', () => {
      const session = createSession();
      const view = makeView([makeNode({ id: 'a' })]);
      session.pushView(view);
      session.updateState('a', { value: 'hello' });

      const serialized = session.serialize();
      const restored = deserialize(serialized);

      expect(restored.sessionId).toBe(session.sessionId);
      expect(restored.getSnapshot()!.data.values['a']).toEqual({
        value: 'hello',
      });
    });

    it('round-trip serialize/deserialize produces identical snapshot', () => {
      const session = createSession();
      const view = makeView([makeNode({ id: 'a' })]);
      session.pushView(view);
      session.updateState('a', { value: 'hello' });

      const serialized = session.serialize();
      const restored = deserialize(serialized);

      expect(restored.getSnapshot()).toEqual(session.getSnapshot());
    });

    it('serialize output includes formatVersion', () => {
      const session = createSession();
      session.pushView(makeView([makeNode({ id: 'a' })]));
      const serialized = session.serialize() as Record<string, unknown>;
      expect(serialized.formatVersion).toBe(1);
    });

    it('deserialize rejects unknown formatVersion', () => {
      const session = createSession();
      session.pushView(makeView([makeNode({ id: 'a' })]));
      const blob = { ...(session.serialize() as Record<string, unknown>), formatVersion: 999 };
      expect(() => deserialize(blob)).toThrow();
    });

    it('deserialize accepts formatVersion 1', () => {
      const session = createSession();
      session.pushView(makeView([makeNode({ id: 'a' })]));
      session.updateState('a', { value: 'hello' });
      const restored = deserialize(session.serialize());
      expect(restored.getSnapshot()!.data.values['a']).toEqual({ value: 'hello' });
    });

    it('deserialize handles legacy blobs without formatVersion', () => {
      const session = createSession();
      session.pushView(makeView([makeNode({ id: 'a' })]));
      session.updateState('a', { value: 'legacy' });
      const blob = session.serialize() as Record<string, unknown>;
      delete blob.formatVersion;
      const restored = deserialize(blob);
      expect(restored.getSnapshot()!.data.values['a']).toEqual({ value: 'legacy' });
    });
  });

  describe('checkpoint stack and rewind', () => {
    it('getCheckpoints returns empty array before any view push', () => {
      const session = createSession();
      expect(session.getCheckpoints()).toEqual([]);
    });

    it('pushView auto-creates a checkpoint', () => {
      const session = createSession();
      session.pushView(makeView([makeNode({ id: 'a' })]));
      expect(session.getCheckpoints()).toHaveLength(1);
    });

    it('latest checkpoint snapshot updates when data changes', () => {
      const session = createSession();
      session.pushView(makeView([makeNode({ id: 'a' })], 's1', '1'));

      session.updateState('a', { value: 'typed' });

      const checkpoints = session.getCheckpoints();
      expect(checkpoints).toHaveLength(1);
      expect(checkpoints[0].snapshot.data.values['a']).toEqual({ value: 'typed' });
    });

    it('each pushView adds a new checkpoint', () => {
      const session = createSession();
      session.pushView(makeView([makeNode({ id: 'a' })], 's1', '1'));
      session.pushView(makeView([makeNode({ id: 'a' }), makeNode({ id: 'b' })], 's2', '2'));
      expect(session.getCheckpoints()).toHaveLength(2);
    });

    it('checkpoint contains the view and data at the time it was created', () => {
      const session = createSession();
      session.pushView(makeView([makeNode({ id: 'a' })], 's1', '1'));
      session.updateState('a', { value: 'hello' });
      session.pushView(makeView([makeNode({ id: 'a' }), makeNode({ id: 'b' })], 's2', '2'));

      const checkpoints = session.getCheckpoints();
      expect(checkpoints[0].snapshot.view.viewId).toBe('s1');
      expect(checkpoints[1].snapshot.view.viewId).toBe('s2');
      expect(checkpoints[1].snapshot.data.values['a']).toEqual({ value: 'hello' });
    });

    it('rewind restores session to a prior checkpoint', () => {
      const session = createSession();
      session.pushView(makeView([makeNode({ id: 'a' })], 's1', '1'));
      session.updateState('a', { value: 'hello' });
      session.pushView(makeView([makeNode({ id: 'a' }), makeNode({ id: 'b' })], 's2', '2'));
      session.updateState('b', { value: 'world' });

      const checkpoints = session.getCheckpoints();
      session.rewind(checkpoints[1].checkpointId);

      expect(session.getSnapshot()!.view.viewId).toBe('s2');
      expect(session.getSnapshot()!.data.values['a']).toEqual({ value: 'hello' });

      session.rewind(session.getCheckpoints()[0].checkpointId);
      expect(session.getSnapshot()!.view.viewId).toBe('s1');
    });

    it('rewind restores typed values from checkpoint even if a later type change dropped them', () => {
      const session = createSession();
      session.pushView(makeView([makeNode({ id: 'loan_type', type: 'field' })], 's1', '1'));
      session.updateState('loan_type', { value: 'mortgage' });
      session.pushView(makeView([makeNode({ id: 'loan_type', type: 'action' })], 's2', '2'));

      expect(session.getSnapshot()!.data.values['loan_type']).toBeUndefined();

      const checkpoints = session.getCheckpoints();
      session.rewind(checkpoints[0].checkpointId);

      expect(session.getSnapshot()!.view.viewId).toBe('s1');
      expect(session.getSnapshot()!.data.values['loan_type']).toEqual({ value: 'mortgage' });
    });

    it('rewind trims the checkpoint stack to the rewound point', () => {
      const session = createSession();
      session.pushView(makeView([makeNode({ id: 'a' })], 's1', '1'));
      session.pushView(makeView([makeNode({ id: 'a' })], 's2', '2'));
      session.pushView(makeView([makeNode({ id: 'a' })], 's3', '3'));

      expect(session.getCheckpoints()).toHaveLength(3);

      const checkpoints = session.getCheckpoints();
      session.rewind(checkpoints[0].checkpointId);

      expect(session.getCheckpoints()).toHaveLength(1);
    });

    it('rewind throws if checkpoint id is unknown', () => {
      const session = createSession();
      session.pushView(makeView([makeNode({ id: 'a' })]));
      expect(() => session.rewind('nonexistent')).toThrow();
    });

    it('rewind notifies snapshot listeners', () => {
      const session = createSession();
      session.pushView(makeView([makeNode({ id: 'a' })], 's1', '1'));
      session.pushView(makeView([makeNode({ id: 'a' })], 's2', '2'));

      const snapshots: unknown[] = [];
      session.onSnapshot((s) => snapshots.push(s));

      session.rewind(session.getCheckpoints()[0].checkpointId);
      expect(snapshots).toHaveLength(1);
      expect((snapshots[0] as { view: { viewId: string } }).view.viewId).toBe('s1');
    });

    it('checkpoints survive serialize/deserialize round-trip', () => {
      const session = createSession();
      session.pushView(makeView([makeNode({ id: 'a' })], 's1', '1'));
      session.updateState('a', { value: 'persisted' });
      session.pushView(makeView([makeNode({ id: 'a' }), makeNode({ id: 'b' })], 's2', '2'));

      const restored = deserialize(session.serialize());
      expect(restored.getCheckpoints()).toHaveLength(2);
      expect(restored.getCheckpoints()[0].snapshot.view.viewId).toBe('s1');
    });

    it('rewind works after deserialize', () => {
      const session = createSession();
      session.pushView(makeView([makeNode({ id: 'a' })], 's1', '1'));
      session.updateState('a', { value: 'before' });
      session.pushView(makeView([makeNode({ id: 'a' }), makeNode({ id: 'b' })], 's2', '2'));
      session.updateState('b', { value: 'after' });

      const restored = deserialize(session.serialize());
      const checkpoints = restored.getCheckpoints();
      restored.rewind(checkpoints[1].checkpointId);

      expect(restored.getSnapshot()!.view.viewId).toBe('s2');
      expect(restored.getSnapshot()!.data.values['a']).toEqual({ value: 'before' });
      expect(restored.getSnapshot()!.data.values['b']).toEqual({ value: 'after' });
    });

    it('auto-checkpoint captures data updates made before next pushView', () => {
      const session = createSession();
      session.pushView(makeView([makeNode({ id: 'a' })], 's1', '1'));
      session.updateState('a', { value: 'typed' });
      session.pushView(makeView([makeNode({ id: 'a' })], 's2', '2'));

      const checkpoints = session.getCheckpoints();
      expect(checkpoints[1].snapshot.data.values['a']).toEqual({ value: 'typed' });
    });
  });

  describe('edge cases', () => {
    it('listener can remove itself during notification without breaking iteration', () => {
      const session = createSession();
      session.pushView(makeView([makeNode({ id: 'a' })]));

      let selfRemoveCalled = false;
      let secondCalled = false;

      const unsub = session.onSnapshot(() => {
        selfRemoveCalled = true;
        unsub();
      });

      session.onSnapshot(() => {
        secondCalled = true;
      });

      session.pushView(makeView([makeNode({ id: 'a' })], 's2', '2'));

      expect(selfRemoveCalled).toBe(true);
      expect(secondCalled).toBe(true);
    });

    it('listener added during notification is called in the same cycle due to Set iteration', () => {
      const session = createSession();
      session.pushView(makeView([makeNode({ id: 'a' })]));

      let lateCalled = false;

      session.onSnapshot(() => {
        session.onSnapshot(() => {
          lateCalled = true;
        });
      });

      session.pushView(makeView([makeNode({ id: 'a' })], 's2', '2'));

      expect(lateCalled).toBe(true);
    });

    it('handles transition from populated view to empty view', () => {
      const session = createSession();
      session.pushView(makeView([makeNode({ id: 'a' })]));
      session.updateState('a', { value: 'hello' });

      session.pushView(makeView([], 's2', '2'));

      const snapshot = session.getSnapshot();
      expect(Object.keys(snapshot!.data.values)).toHaveLength(0);
    });

    it('handles empty view as the very first push', () => {
      const session = createSession();
      session.pushView(makeView([]));

      const snapshot = session.getSnapshot();
      expect(snapshot).not.toBeNull();
      expect(Object.keys(snapshot!.data.values)).toHaveLength(0);
    });

    it('handles rapid successive view pushes', () => {
      const session = createSession();
      for (let i = 0; i < 50; i++) {
        session.pushView(
          makeView(
            [makeNode({ id: 'a' })],
            `s${i}`,
            `${i}`
          )
        );
      }

      const snapshot = session.getSnapshot();
      expect(snapshot!.view.version).toBe('49');
      expect(session.getCheckpoints()).toHaveLength(50);
    });

    it('handles deeply nested children data carry across pushes', () => {
      const deep = makeNode({ id: 'deep' });
      const mid = makeNode({ id: 'mid', type: 'group', children: [deep] });
      const root = makeNode({ id: 'root', type: 'group', children: [mid] });

      const session = createSession();
      session.pushView(makeView([root], 's1', '1'));
      session.updateState('root/mid/deep', { value: 'nested' });

      session.pushView(makeView([root], 's2', '2'));

      expect(session.getSnapshot()!.data.values['root/mid/deep']).toEqual({ value: 'nested' });
    });

    it('updateState and recordIntent throw after destroy', () => {
      const session = createSession();
      session.pushView(makeView([makeNode({ id: 'a' })]));
      session.destroy();

      expect(() => session.updateState('a', { value: 'nope' })).toThrow('Session has been destroyed');
      expect(() =>
        session.recordIntent({ nodeId: 'a', type: 'value-change', payload: { value: 'nope' } })
      ).toThrow('Session has been destroyed');
    });
  });

  describe('viewport state', () => {
    it('updates viewport state and linearly increments timestamp', () => {
      const clock = vi.fn().mockReturnValue(1000);
      const session = createSession({ clock });
      session.pushView(makeView([makeNode({ id: 'a' })]));

      clock.mockReturnValue(2000);
      session.updateViewportState('a', { scrollY: 100 });

      const snapshot = session.getSnapshot()!;
      expect(snapshot.data.viewContext?.['a']).toEqual({ scrollY: 100 });
      expect(snapshot.data.lineage.timestamp).toBe(2000);
    });
  });

  describe('reset', () => {
    it('clears all session state and notifies listeners', () => {
      const session = createSession();
      session.pushView(makeView([makeNode({ id: 'a' })]));
      session.updateState('a', { value: 'test' });
      
      const listener = vi.fn();
      session.onSnapshot(listener);

      session.reset();

      expect(session.getSnapshot()).toBeNull();
      expect(session.getEventLog()).toHaveLength(0);
      expect(session.getCheckpoints()).toHaveLength(0);
      expect(listener).toHaveBeenCalledWith(null);
    });
  });

  describe('event log capping', () => {
    it('limits event log size based on options', () => {
      const session = createSession({ maxEventLogSize: 5 });
      session.pushView(makeView([makeNode({ id: 'a' })]));

      for (let i = 0; i < 10; i++) {
        session.updateState('a', { value: `val-${i}` });
      }

      const log = session.getEventLog();
      expect(log).toHaveLength(5);
      expect(log[log.length - 1].payload).toEqual({ value: 'val-9' });
    });
  });

  describe('onIssues listener', () => {
    it('fires when a view push results in issues', () => {
      const session = createSession();
      const listener = vi.fn();
      session.onIssues(listener);
      // Push valid view
      session.pushView(makeView([makeNode({ id: 'a', type: 'field' })]));
      expect(listener).toHaveBeenCalledWith([
        expect.objectContaining({ code: 'NO_PRIOR_DATA' })
      ]);

      // Push view with type mismatch
      session.pushView(makeView([makeNode({ id: 'a', type: 'action' })]));
      expect(listener).toHaveBeenCalledTimes(2);
      expect(listener.mock.calls[1][0][0].code).toBe('TYPE_MISMATCH');
    });
  });
});
