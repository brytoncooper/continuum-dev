import { describe, it, expect, vi } from 'vitest';
import { createEmptySessionState } from '../state/index.js';
import { recordIntent } from './event-log.js';
import { ISSUE_CODES } from '@continuum-dev/protocol';

const aiFlexibleProtection = {
  owner: 'ai',
  stage: 'flexible',
} as const;

const aiReviewedProtection = {
  owner: 'ai',
  stage: 'reviewed',
} as const;

function setupWithView(internal: ReturnType<typeof createEmptySessionState>) {
  internal.currentView = {
    viewId: 's1',
    version: '1.0',
    nodes: [{ id: 'a', type: 'field' as const, dataType: 'string' as const }],
  };
  internal.currentData = {
    values: {},
    lineage: { timestamp: 1000, sessionId: 's' },
  };
}

describe('recordIntent', () => {
  it('adds an interaction to the event log', () => {
    const internal = createEmptySessionState('s', () => 5000);
    setupWithView(internal);

    recordIntent(internal, {
      nodeId: 'a',
      type: 'value-change',
      payload: { value: 'hello' },
    });

    expect(internal.eventLog).toHaveLength(1);
    expect(internal.eventLog[0].nodeId).toBe('a');
    expect(internal.eventLog[0].type).toBe('value-change');
  });

  it('updates node value from payload', () => {
    const internal = createEmptySessionState('s', () => 5000);
    setupWithView(internal);

    recordIntent(internal, {
      nodeId: 'a',
      type: 'value-change',
      payload: { value: 'updated' },
    });

    expect(internal.currentData!.values['a']).toEqual({
      value: 'updated',
      protection: aiFlexibleProtection,
    });
  });

  it('updates valueLineage with lastUpdated and lastInteractionId', () => {
    const internal = createEmptySessionState('s', () => 5000);
    setupWithView(internal);

    recordIntent(internal, {
      nodeId: 'a',
      type: 'value-change',
      payload: { value: 'hello' },
    });

    expect(internal.currentData!.valueLineage!['a']).toBeDefined();
    expect(internal.currentData!.valueLineage!['a'].lastUpdated).toBeDefined();
    expect(
      internal.currentData!.valueLineage!['a'].lastInteractionId
    ).toBeDefined();
  });

  it('notifies snapshot listeners', () => {
    const internal = createEmptySessionState('s', () => 5000);
    setupWithView(internal);
    const listener = vi.fn();
    internal.snapshotListeners.add(listener);

    recordIntent(internal, {
      nodeId: 'a',
      type: 'value-change',
      payload: { value: 'hello' },
    });

    expect(listener).toHaveBeenCalledOnce();
  });

  it('does nothing when destroyed', () => {
    const internal = createEmptySessionState('s', () => 5000);
    setupWithView(internal);
    internal.destroyed = true;

    recordIntent(internal, {
      nodeId: 'a',
      type: 'value-change',
      payload: { value: 'hello' },
    });

    expect(internal.eventLog).toHaveLength(0);
  });

  it('does nothing when no data exists', () => {
    const internal = createEmptySessionState('s', () => 5000);

    recordIntent(internal, {
      nodeId: 'a',
      type: 'value-change',
      payload: { value: 'hello' },
    });

    expect(internal.eventLog).toHaveLength(0);
  });

  it('throws when interaction type is invalid', () => {
    const internal = createEmptySessionState('s', () => 5000);
    setupWithView(internal);

    expect(() =>
      recordIntent(internal, {
        nodeId: 'a',
        type: 'invalid-type' as never,
        payload: { value: 'hello' },
      })
    ).toThrow('Invalid interaction type');
  });

  it('stores a cloned payload value', () => {
    const internal = createEmptySessionState('s', () => 5000);
    setupWithView(internal);
    const payload = { value: 'hello', protection: aiReviewedProtection };

    recordIntent(internal, { nodeId: 'a', type: 'value-change', payload });
    payload.value = 'changed-after';

    expect(internal.currentData?.values['a']).toEqual({
      value: 'hello',
      protection: aiReviewedProtection,
    });
  });

  it('deduplicates unknown-node issues by nodeId and code', () => {
    const internal = createEmptySessionState('s', () => 5000);
    setupWithView(internal);

    recordIntent(internal, {
      nodeId: 'missing',
      type: 'value-change',
      payload: { value: 'x' },
    });
    recordIntent(internal, {
      nodeId: 'missing',
      type: 'value-change',
      payload: { value: 'y' },
    });

    const unknownNodeIssues = internal.issues.filter(
      (issue) =>
        issue.code === ISSUE_CODES.UNKNOWN_NODE && issue.nodeId === 'missing'
    );
    expect(unknownNodeIssues).toHaveLength(1);
  });

  it('deduplicates validation issues by nodeId and code', () => {
    const internal = createEmptySessionState('s', () => 5000);
    internal.currentView = {
      viewId: 's1',
      version: '1.0',
      nodes: [
        {
          id: 'a',
          type: 'field',
          dataType: 'string',
          constraints: { required: true },
        },
      ],
    };
    internal.currentData = {
      values: {},
      lineage: { timestamp: 1000, sessionId: 's' },
    };
    internal.validateOnUpdate = true;

    recordIntent(internal, {
      nodeId: 'a',
      type: 'value-change',
      payload: { value: '' },
    });
    recordIntent(internal, {
      nodeId: 'a',
      type: 'value-change',
      payload: { value: '' },
    });

    const validationIssues = internal.issues.filter(
      (issue) =>
        issue.code === ISSUE_CODES.VALIDATION_FAILED && issue.nodeId === 'a'
    );
    expect(validationIssues).toHaveLength(1);
  });
});
