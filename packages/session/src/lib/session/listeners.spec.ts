import { describe, it, expect, vi } from 'vitest';
import { createInitialState } from './session-state.js';
import {
  getSnapshotFromState,
  notifySnapshotListeners,
  notifyIssueListeners,
  notifyAllListeners,
} from './listeners.js';
import type { SchemaSnapshot, StateSnapshot } from '@continuum/contract';

function makeSchema(): SchemaSnapshot {
  return { schemaId: 's1', version: '1.0', components: [] };
}

function makeState(): StateSnapshot {
  return { values: {}, meta: { timestamp: 1000, sessionId: 'test' } };
}

describe('getSnapshotFromState', () => {
  it('returns null when no schema is set', () => {
    const internal = createInitialState('s', () => 0);
    expect(getSnapshotFromState(internal)).toBeNull();
  });

  it('returns null when no state is set', () => {
    const internal = createInitialState('s', () => 0);
    internal.currentSchema = makeSchema();
    expect(getSnapshotFromState(internal)).toBeNull();
  });

  it('returns snapshot when both schema and state are set', () => {
    const internal = createInitialState('s', () => 0);
    internal.currentSchema = makeSchema();
    internal.currentState = makeState();
    const snapshot = getSnapshotFromState(internal);
    expect(snapshot).not.toBeNull();
    expect(snapshot!.schema).toBe(internal.currentSchema);
    expect(snapshot!.state).toBe(internal.currentState);
  });
});

describe('notifySnapshotListeners', () => {
  it('calls all registered snapshot listeners', () => {
    const internal = createInitialState('s', () => 0);
    internal.currentSchema = makeSchema();
    internal.currentState = makeState();
    const listener1 = vi.fn();
    const listener2 = vi.fn();
    internal.snapshotListeners.add(listener1);
    internal.snapshotListeners.add(listener2);

    notifySnapshotListeners(internal);

    expect(listener1).toHaveBeenCalledOnce();
    expect(listener2).toHaveBeenCalledOnce();
  });

  it('does not call listeners when snapshot is null', () => {
    const internal = createInitialState('s', () => 0);
    const listener = vi.fn();
    internal.snapshotListeners.add(listener);

    notifySnapshotListeners(internal);

    expect(listener).not.toHaveBeenCalled();
  });
});

describe('notifyIssueListeners', () => {
  it('calls all registered issue listeners with a copy of issues', () => {
    const internal = createInitialState('s', () => 0);
    internal.issues = [{ severity: 'info', message: 'test', code: 'TEST' }];
    const listener = vi.fn();
    internal.issueListeners.add(listener);

    notifyIssueListeners(internal);

    expect(listener).toHaveBeenCalledOnce();
    expect(listener.mock.calls[0][0]).toEqual(internal.issues);
    expect(listener.mock.calls[0][0]).not.toBe(internal.issues);
  });
});

describe('notifyAllListeners', () => {
  it('calls both snapshot and issue listeners', () => {
    const internal = createInitialState('s', () => 0);
    internal.currentSchema = makeSchema();
    internal.currentState = makeState();
    const snapshotListener = vi.fn();
    const issueListener = vi.fn();
    internal.snapshotListeners.add(snapshotListener);
    internal.issueListeners.add(issueListener);

    notifyAllListeners(internal);

    expect(snapshotListener).toHaveBeenCalledOnce();
    expect(issueListener).toHaveBeenCalledOnce();
  });
});
