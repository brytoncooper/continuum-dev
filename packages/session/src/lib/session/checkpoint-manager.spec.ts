import { describe, it, expect, vi } from 'vitest';
import { createEmptySessionState } from './session-state.js';
import { autoCheckpoint, createManualCheckpoint, restoreFromCheckpoint, rewind } from './checkpoint-manager.js';
import type { SchemaSnapshot, StateSnapshot, Checkpoint } from '@continuum/contract';

function setupWithSnapshot(internal: ReturnType<typeof createEmptySessionState>) {
  internal.currentSchema = { schemaId: 's1', version: '1.0', components: [] };
  internal.currentState = { values: { a: { value: 'hello' } }, meta: { timestamp: 1000, sessionId: 's' } };
}

describe('autoCheckpoint', () => {
  it('adds a checkpoint to the stack', () => {
    const internal = createEmptySessionState('s', () => 5000);
    setupWithSnapshot(internal);

    autoCheckpoint(internal);

    expect(internal.checkpoints).toHaveLength(1);
    expect(internal.checkpoints[0].sessionId).toBe('s');
    expect(internal.checkpoints[0].snapshot.state.values['a']).toEqual({ value: 'hello' });
  });

  it('does nothing when snapshot is null', () => {
    const internal = createEmptySessionState('s', () => 5000);

    autoCheckpoint(internal);

    expect(internal.checkpoints).toHaveLength(0);
  });
});

describe('createManualCheckpoint', () => {
  it('returns a checkpoint without modifying the stack', () => {
    const internal = createEmptySessionState('s', () => 5000);
    setupWithSnapshot(internal);

    const cp = createManualCheckpoint(internal);

    expect(cp.sessionId).toBe('s');
    expect(cp.snapshot.state.values['a']).toEqual({ value: 'hello' });
    expect(internal.checkpoints).toHaveLength(0);
  });
});

describe('restoreFromCheckpoint', () => {
  it('restores schema and state from the checkpoint', () => {
    const internal = createEmptySessionState('s', () => 5000);
    setupWithSnapshot(internal);
    autoCheckpoint(internal);

    internal.currentState = { values: { a: { value: 'changed' } }, meta: { timestamp: 2000, sessionId: 's' } };

    restoreFromCheckpoint(internal, internal.checkpoints[0]);

    expect(internal.currentState!.values['a']).toEqual({ value: 'hello' });
  });

  it('clears issues, diffs, trace, and pending actions', () => {
    const internal = createEmptySessionState('s', () => 5000);
    setupWithSnapshot(internal);
    autoCheckpoint(internal);
    internal.issues = [{ severity: 'info', message: 'test', code: 'TEST' }];
    internal.pendingActions = [{ id: 'a', componentId: 'a', actionType: 'x', payload: {}, createdAt: 0, schemaVersion: '1', status: 'pending' }];

    restoreFromCheckpoint(internal, internal.checkpoints[0]);

    expect(internal.issues).toEqual([]);
    expect(internal.diffs).toEqual([]);
    expect(internal.trace).toEqual([]);
    expect(internal.pendingActions).toEqual([]);
  });

  it('does nothing when destroyed', () => {
    const internal = createEmptySessionState('s', () => 5000);
    setupWithSnapshot(internal);
    autoCheckpoint(internal);
    internal.destroyed = true;
    const stateBefore = internal.currentState;

    restoreFromCheckpoint(internal, internal.checkpoints[0]);

    expect(internal.currentState).toBe(stateBefore);
  });

  it('restores into isolated state objects that do not mutate checkpoint snapshots', () => {
    const internal = createEmptySessionState('s', () => 5000);
    setupWithSnapshot(internal);

    const cp = createManualCheckpoint(internal);
    restoreFromCheckpoint(internal, cp);

    internal.currentState!.values['a'] = { value: 'mutated' };
    internal.currentSchema!.schemaId = 'changed';

    expect(cp.snapshot.state.values['a']).toEqual({ value: 'hello' });
    expect(cp.snapshot.schema.schemaId).toBe('s1');
  });
});

describe('rewind', () => {
  it('restores to the specified checkpoint and trims the stack', () => {
    let time = 1000;
    const internal = createEmptySessionState('s', () => time++);
    setupWithSnapshot(internal);
    autoCheckpoint(internal);
    internal.currentSchema = { schemaId: 's2', version: '2.0', components: [] };
    autoCheckpoint(internal);
    internal.currentSchema = { schemaId: 's3', version: '3.0', components: [] };
    autoCheckpoint(internal);

    expect(internal.checkpoints).toHaveLength(3);

    rewind(internal, internal.checkpoints[0].id);

    expect(internal.checkpoints).toHaveLength(1);
    expect(internal.currentSchema!.schemaId).toBe('s1');
  });

  it('throws when checkpoint id is not found', () => {
    const internal = createEmptySessionState('s', () => 5000);
    setupWithSnapshot(internal);
    autoCheckpoint(internal);

    expect(() => rewind(internal, 'nonexistent')).toThrow();
  });
});
