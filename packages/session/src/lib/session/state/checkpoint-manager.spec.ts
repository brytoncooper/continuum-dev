import type { DataSnapshot } from '@continuum-dev/contract';
import { describe, it, expect } from 'vitest';
import { createEmptySessionState } from './session-state.js';
import { autoCheckpoint, createManualCheckpoint, restoreFromCheckpoint, rewind } from './checkpoint-manager.js';

function setupWithSnapshot(internal: ReturnType<typeof createEmptySessionState>) {
  internal.currentView = { viewId: 's1', version: '1.0', nodes: [] };
  internal.currentData = { values: { a: { value: 'hello' } }, lineage: { timestamp: 1000, sessionId: 's' } };
}

describe('autoCheckpoint', () => {
  it('adds a checkpoint to the stack', () => {
    const internal = createEmptySessionState('s', () => 5000);
    setupWithSnapshot(internal);

    autoCheckpoint(internal);

    expect(internal.checkpoints).toHaveLength(1);
    expect(internal.checkpoints[0].sessionId).toBe('s');
    expect(internal.checkpoints[0].snapshot.data.values['a']).toEqual({ value: 'hello' });
  });

  it('does nothing when snapshot is null', () => {
    const internal = createEmptySessionState('s', () => 5000);

    autoCheckpoint(internal);

    expect(internal.checkpoints).toHaveLength(0);
  });
});

describe('createManualCheckpoint', () => {
  it('returns a checkpoint and appends it to the stack', () => {
    const internal = createEmptySessionState('s', () => 5000);
    setupWithSnapshot(internal);

    const cp = createManualCheckpoint(internal);

    expect(cp.sessionId).toBe('s');
    expect(cp.snapshot.data.values['a']).toEqual({ value: 'hello' });
    expect(internal.checkpoints).toHaveLength(1);
    expect(internal.checkpoints[0].checkpointId).toBe(cp.checkpointId);
  });

  it('preserves undefined values in checkpoint snapshots', () => {
    const internal = createEmptySessionState('s', () => 5000);
    internal.currentView = { viewId: 's1', version: '1.0', nodes: [] };
    internal.currentData = {
      values: { a: { value: undefined, isDirty: true, isSticky: true } },
      lineage: { timestamp: 1000, sessionId: 's' },
    };

    const cp = createManualCheckpoint(internal);

    expect(cp.snapshot.data.values.a).toHaveProperty('value');
    expect(cp.snapshot.data.values.a.value).toBeUndefined();
    expect(cp.snapshot.data.values.a.isDirty).toBe(true);
    expect(cp.snapshot.data.values.a.isSticky).toBe(true);
  });

  it('preserves Date values in checkpoint snapshots', () => {
    const internal = createEmptySessionState('s', () => 5000);
    const createdAt = new Date('2026-03-01T00:00:00.000Z');
    internal.currentView = { viewId: 's1', version: '1.0', nodes: [] };
    internal.currentData = {
      values: { a: { value: createdAt } },
      lineage: { timestamp: 1000, sessionId: 's' },
    };

    const cp = createManualCheckpoint(internal);

    expect(cp.snapshot.data.values.a.value).toBeInstanceOf(Date);
    expect(cp.snapshot.data.values.a.value).toEqual(createdAt);
  });

  it('enforces maxCheckpoints for manual checkpoints', () => {
    let now = 1000;
    const internal = createEmptySessionState('s', () => now++);
    internal.maxCheckpoints = 2;
    setupWithSnapshot(internal);

    createManualCheckpoint(internal);
    createManualCheckpoint(internal);
    createManualCheckpoint(internal);

    expect(internal.checkpoints).toHaveLength(2);
    expect(internal.checkpoints.every((cp) => cp.trigger === 'manual')).toBe(true);
  });
});

describe('restoreFromCheckpoint', () => {
  it('restores view and data from the checkpoint', () => {
    const internal = createEmptySessionState('s', () => 5000);
    setupWithSnapshot(internal);
    autoCheckpoint(internal);

    internal.currentData = { values: { a: { value: 'changed' } }, lineage: { timestamp: 2000, sessionId: 's' } };

    restoreFromCheckpoint(internal, internal.checkpoints[0]);

    expect(internal.currentData!.values['a']).toEqual({ value: 'hello' });
  });

  it('clears issues, diffs, resolutions, and pending intents', () => {
    const internal = createEmptySessionState('s', () => 5000);
    setupWithSnapshot(internal);
    autoCheckpoint(internal);
    internal.issues = [{ severity: 'info', message: 'test', code: 'TEST' }];
    internal.pendingIntents = [{ intentId: 'a', nodeId: 'a', intentName: 'x', payload: {}, queuedAt: 0, viewVersion: '1', status: 'pending' }];

    restoreFromCheckpoint(internal, internal.checkpoints[0]);

    expect(internal.issues).toEqual([]);
    expect(internal.diffs).toEqual([]);
    expect(internal.resolutions).toEqual([]);
    expect(internal.pendingIntents).toEqual([]);
  });

  it('does nothing when destroyed', () => {
    const internal = createEmptySessionState('s', () => 5000);
    setupWithSnapshot(internal);
    autoCheckpoint(internal);
    internal.destroyed = true;
    const dataBefore = internal.currentData;

    restoreFromCheckpoint(internal, internal.checkpoints[0]);

    expect(internal.currentData).toBe(dataBefore);
  });

  it('restores into isolated data objects that do not mutate checkpoint snapshots', () => {
    const internal = createEmptySessionState('s', () => 5000);
    setupWithSnapshot(internal);

    const cp = createManualCheckpoint(internal);
    restoreFromCheckpoint(internal, cp);

    internal.currentData!.values['a'] = { value: 'mutated' };
    internal.currentView!.viewId = 'changed';

    expect(cp.snapshot.data.values['a']).toEqual({ value: 'hello' });
    expect(cp.snapshot.view.viewId).toBe('s1');
  });

  it('preserves Date values when restoring from checkpoint', () => {
    const internal = createEmptySessionState('s', () => 5000);
    const createdAt = new Date('2026-03-01T00:00:00.000Z');
    internal.currentView = { viewId: 's1', version: '1.0', nodes: [] };
    internal.currentData = {
      values: { a: { value: createdAt } },
      lineage: { timestamp: 1000, sessionId: 's' },
    };
    const cp = createManualCheckpoint(internal);

    internal.currentData = {
      values: { a: { value: 'changed' } },
      lineage: { timestamp: 2000, sessionId: 's' },
    };
    restoreFromCheckpoint(internal, cp);

    expect(internal.currentData?.values.a.value).toBeInstanceOf(Date);
    expect(internal.currentData?.values.a.value).toEqual(createdAt);
  });

  it('strips legacy viewContext when restoring from checkpoint', () => {
    const internal = createEmptySessionState('s', () => 5000);
    internal.currentView = { viewId: 's1', version: '1.0', nodes: [] };
    internal.currentData = {
      values: { a: { value: 'changed' } },
      lineage: { timestamp: 2000, sessionId: 's' },
    };
    const cp = {
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
      trigger: 'manual' as const,
    };

    restoreFromCheckpoint(internal, cp);

    expect('viewContext' in (internal.currentData as object)).toBe(false);
  });

  it('clears focus when restoring to a view that no longer contains the focused node', () => {
    const internal = createEmptySessionState('s', () => 5000);
    internal.currentView = {
      viewId: 's1',
      version: '1.0',
      nodes: [{ id: 'a', type: 'field', dataType: 'string' }],
    };
    internal.currentData = {
      values: { a: { value: 'hello' } },
      lineage: { timestamp: 1000, sessionId: 's' },
    };
    internal.focusedNodeId = 'a';
    const cp = {
      checkpointId: 'cp-1',
      sessionId: 's',
      snapshot: {
        view: { viewId: 's1', version: '2.0', nodes: [] },
        data: {
          values: {},
          lineage: { timestamp: 1001, sessionId: 's' },
        },
      },
      eventIndex: 0,
      timestamp: 1001,
      trigger: 'manual' as const,
    };

    restoreFromCheckpoint(internal, cp);

    expect(internal.focusedNodeId).toBeNull();
  });
});

describe('rewind', () => {
  it('restores to the specified checkpoint and trims the stack', () => {
    let time = 1000;
    const internal = createEmptySessionState('s', () => time++);
    setupWithSnapshot(internal);
    autoCheckpoint(internal);
    internal.currentView = { viewId: 's2', version: '2.0', nodes: [] };
    autoCheckpoint(internal);
    internal.currentView = { viewId: 's3', version: '3.0', nodes: [] };
    autoCheckpoint(internal);

    expect(internal.checkpoints).toHaveLength(3);

    rewind(internal, internal.checkpoints[0].checkpointId);

    expect(internal.checkpoints).toHaveLength(1);
    expect(internal.currentView!.viewId).toBe('s1');
  });

  it('throws when checkpoint id is not found', () => {
    const internal = createEmptySessionState('s', () => 5000);
    setupWithSnapshot(internal);
    autoCheckpoint(internal);

    expect(() => rewind(internal, 'nonexistent')).toThrow();
  });

  it('clears focus when rewinding to a checkpoint without the focused node', () => {
    let time = 1000;
    const internal = createEmptySessionState('s', () => time++);
    internal.currentView = {
      viewId: 's1',
      version: '1.0',
      nodes: [{ id: 'a', type: 'field', dataType: 'string' }],
    };
    internal.currentData = {
      values: { a: { value: 'hello' } },
      lineage: { timestamp: 1000, sessionId: 's' },
    };
    autoCheckpoint(internal);
    internal.currentView = {
      viewId: 's2',
      version: '2.0',
      nodes: [{ id: 'b', type: 'field', dataType: 'string' }],
    };
    internal.currentData = {
      values: { b: { value: 'world' } },
      lineage: { timestamp: 1001, sessionId: 's' },
    };
    autoCheckpoint(internal);
    internal.focusedNodeId = 'b';

    rewind(internal, internal.checkpoints[0].checkpointId);

    expect(internal.focusedNodeId).toBeNull();
  });
});
