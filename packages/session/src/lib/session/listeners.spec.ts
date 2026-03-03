import { describe, it, expect, vi } from 'vitest';
import { createEmptySessionState } from './session-state.js';
import {
  buildSnapshotFromCurrentState,
  notifySnapshotListeners,
  notifyIssueListeners,
  notifySnapshotAndIssueListeners,
} from './listeners.js';
import type { ViewDefinition, DataSnapshot } from '@continuum/contract';

function makeView(): ViewDefinition {
  return { viewId: 's1', version: '1.0', nodes: [] };
}

function makeData(): DataSnapshot {
  return { values: {}, lineage: { timestamp: 1000, sessionId: 'test' } };
}

describe('buildSnapshotFromCurrentState', () => {
  it('returns null when no view is set', () => {
    const internal = createEmptySessionState('s', () => 0);
    expect(buildSnapshotFromCurrentState(internal)).toBeNull();
  });

  it('returns null when no data is set', () => {
    const internal = createEmptySessionState('s', () => 0);
    internal.currentView = makeView();
    expect(buildSnapshotFromCurrentState(internal)).toBeNull();
  });

  it('returns snapshot when both view and data are set', () => {
    const internal = createEmptySessionState('s', () => 0);
    internal.currentView = makeView();
    internal.currentData = makeData();
    const snapshot = buildSnapshotFromCurrentState(internal);
    expect(snapshot).not.toBeNull();
    expect(snapshot!.view).toBe(internal.currentView);
    expect(snapshot!.data).toBe(internal.currentData);
  });
});

describe('notifySnapshotListeners', () => {
  it('calls all registered snapshot listeners', () => {
    const internal = createEmptySessionState('s', () => 0);
    internal.currentView = makeView();
    internal.currentData = makeData();
    const listener1 = vi.fn();
    const listener2 = vi.fn();
    internal.snapshotListeners.add(listener1);
    internal.snapshotListeners.add(listener2);

    notifySnapshotListeners(internal);

    expect(listener1).toHaveBeenCalledOnce();
    expect(listener2).toHaveBeenCalledOnce();
  });

  it('calls listener with null when snapshot is null', () => {
    const internal = createEmptySessionState('s', () => 0);
    const listener = vi.fn();
    internal.snapshotListeners.add(listener);

    notifySnapshotListeners(internal);

    expect(listener).toHaveBeenCalledWith(null);
  });
});

describe('notifyIssueListeners', () => {
  it('calls all registered issue listeners with a copy of issues', () => {
    const internal = createEmptySessionState('s', () => 0);
    internal.issues = [{ severity: 'info', message: 'test', code: 'TEST' }];
    const listener = vi.fn();
    internal.issueListeners.add(listener);

    notifyIssueListeners(internal);

    expect(listener).toHaveBeenCalledOnce();
    expect(listener.mock.calls[0][0]).toEqual(internal.issues);
    expect(listener.mock.calls[0][0]).not.toBe(internal.issues);
  });
});

describe('notifySnapshotAndIssueListeners', () => {
  it('calls both snapshot and issue listeners', () => {
    const internal = createEmptySessionState('s', () => 0);
    internal.currentView = makeView();
    internal.currentData = makeData();
    const snapshotListener = vi.fn();
    const issueListener = vi.fn();
    internal.snapshotListeners.add(snapshotListener);
    internal.issueListeners.add(issueListener);

    notifySnapshotAndIssueListeners(internal);

    expect(snapshotListener).toHaveBeenCalledOnce();
    expect(issueListener).toHaveBeenCalledOnce();
  });
});
