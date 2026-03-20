import { describe, expect, it, vi } from 'vitest';
import {
  applyContinuumExecutionFinalResult,
  buildContinuumExecutionContext,
  runContinuumExecution,
} from '../execution/index.js';
import { createContinuumSessionAdapter } from './index.js';

describe('continuum session adapter', () => {
  it('delegates required and optional session methods through the adapter', () => {
    const snapshot = {
      view: {
        viewId: 'profile',
        version: '1',
        nodes: [],
      },
      data: {
        values: {},
      },
    };

    const committedSnapshot = {
      view: {
        viewId: 'profile',
        version: '0',
        nodes: [],
      },
      data: {
        values: {},
      },
    };

    const pushView = vi.fn();
    const getSnapshot = vi.fn(() => snapshot);
    const getCommittedSnapshot = vi.fn(() => committedSnapshot);
    const getDetachedValues = vi.fn(() => ({
      person: 'Jordan',
    }));
    const getIssues = vi.fn(() => ['missing email']);
    const getPendingProposals = vi.fn(() => ({
      email: {
        proposedValue: {
          value: 'jordan@example.com',
        },
      },
    }));
    const acceptProposal = vi.fn();
    const rejectProposal = vi.fn();
    const rewind = vi.fn();
    const reset = vi.fn();
    const updateState = vi.fn();
    const proposeValue = vi.fn();

    const session = {
      sessionId: 'session-1',
      getSnapshot,
      getCommittedSnapshot,
      getDetachedValues,
      getIssues,
      pushView,
      beginStream(this: { sessionId: string }, options: { mode: string }) {
        return {
          streamId: `stream-for-${this.sessionId}`,
          mode: options.mode,
        };
      },
      applyStreamPart(this: { sessionId: string }, streamId: string, part: unknown) {
        return `${this.sessionId}:${streamId}:${JSON.stringify(part)}`;
      },
      commitStream(this: { sessionId: string }, streamId: string) {
        return {
          streamId,
          committedBy: this.sessionId,
        };
      },
      abortStream(this: { sessionId: string }, streamId: string, reason?: string) {
        return {
          streamId,
          reason,
          abortedBy: this.sessionId,
        };
      },
      getStreams(this: { sessionId: string }) {
        return [{ streamId: `stream-for-${this.sessionId}` }];
      },
      getPendingProposals,
      getPendingRestoreReviews(this: { sessionId: string }) {
        return [{ detachedKey: this.sessionId }];
      },
      acceptProposal,
      rejectProposal,
      acceptRestoreCandidate: vi.fn(),
      rejectRestoreReview: vi.fn(),
      rewind,
      reset,
      updateState,
      proposeValue,
    };

    const adapter = createContinuumSessionAdapter(session);
    const applyOptions = {
      reason: 'test',
    };

    expect(adapter.sessionId).toBe('session-1');
    expect(adapter.getSnapshot()).toBe(snapshot);
    expect(adapter.getCommittedSnapshot()).toBe(committedSnapshot);
    expect(adapter.getDetachedValues()).toEqual({ person: 'Jordan' });
    expect(adapter.getIssues()).toEqual(['missing email']);

    adapter.applyView(snapshot.view, applyOptions as never);
    expect(pushView).toHaveBeenCalledWith(snapshot.view, applyOptions);

    expect(adapter.beginStream?.({ mode: 'patch' } as never)).toEqual({
      streamId: 'stream-for-session-1',
      mode: 'patch',
    });
    expect(
      adapter.applyStreamPart?.('stream-1', { kind: 'text-delta' } as never)
    ).toBe('session-1:stream-1:{"kind":"text-delta"}');
    expect(adapter.commitStream?.('stream-1')).toEqual({
      streamId: 'stream-1',
      committedBy: 'session-1',
    });
    expect(adapter.abortStream?.('stream-1', 'stop')).toEqual({
      streamId: 'stream-1',
      reason: 'stop',
      abortedBy: 'session-1',
    });
    expect(adapter.getStreams?.()).toEqual([
      {
        streamId: 'stream-for-session-1',
      },
    ]);

    expect(adapter.getPendingProposals()).toEqual({
      email: {
        proposedValue: {
          value: 'jordan@example.com',
        },
      },
    });
    expect(adapter.getPendingRestoreReviews()).toEqual([
      {
        detachedKey: 'session-1',
      },
    ]);

    adapter.acceptProposal('profile/email');
    adapter.rejectProposal('profile/email');
    adapter.acceptRestoreCandidate('detached:email', 'profile/email', 'view');
    adapter.rejectRestoreReview('detached:email', 'view');
    adapter.rewind('checkpoint-1');
    adapter.reset();
    adapter.updateState('profile/email', { value: 'jordan@example.com' });
    adapter.proposeValue(
      'profile/email',
      { value: 'jordan@example.com' },
      'assistant'
    );

    expect(acceptProposal).toHaveBeenCalledWith('profile/email');
    expect(rejectProposal).toHaveBeenCalledWith('profile/email');
    expect(session.acceptRestoreCandidate).toHaveBeenCalledWith(
      'detached:email',
      'profile/email',
      'view'
    );
    expect(session.rejectRestoreReview).toHaveBeenCalledWith(
      'detached:email',
      'view'
    );
    expect(rewind).toHaveBeenCalledWith('checkpoint-1');
    expect(reset).toHaveBeenCalled();
    expect(updateState).toHaveBeenCalledWith('profile/email', {
      value: 'jordan@example.com',
    });
    expect(proposeValue).toHaveBeenCalledWith(
      'profile/email',
      { value: 'jordan@example.com' },
      'assistant'
    );
  });

  it('provides safe fallbacks when optional session methods are missing', () => {
    const session = {
      sessionId: 'session-2',
      getSnapshot: () => undefined,
      getDetachedValues: () => ({}),
      getIssues: () => [],
      pushView: vi.fn(),
      getPendingProposals: () => ({}),
      acceptProposal: vi.fn(),
      rejectProposal: vi.fn(),
      rewind: vi.fn(),
      reset: vi.fn(),
      updateState: vi.fn(),
      proposeValue: vi.fn(),
    };

    const adapter = createContinuumSessionAdapter(session);

    expect(adapter.getCommittedSnapshot()).toBeUndefined();
    expect(adapter.beginStream).toBeUndefined();
    expect(adapter.applyStreamPart).toBeUndefined();
    expect(adapter.commitStream).toBeUndefined();
    expect(adapter.abortStream).toBeUndefined();
    expect(adapter.getStreams).toBeUndefined();
    expect(adapter.getPendingRestoreReviews()).toEqual([]);
    expect(adapter.acceptRestoreCandidate('detached:key', 'profile/email', 'view')).toBeUndefined();
    expect(adapter.rejectRestoreReview('detached:key', 'view')).toBeUndefined();
  });

  it('works with the real state-mode generation path and streams parsed updates', async () => {
    const view = {
      viewId: 'household',
      version: '1',
      nodes: [
        {
          id: 'household_group',
          type: 'group',
          children: [
            {
              id: 'dependents',
              type: 'collection',
              key: 'person.dependents',
              semanticKey: 'person.dependents',
              template: {
                id: 'dependent',
                type: 'group',
                children: [
                  {
                    id: 'name',
                    type: 'field',
                    dataType: 'string',
                    key: 'dependent.name',
                    semanticKey: 'person.dependentName',
                  },
                  {
                    id: 'relationship',
                    type: 'radio-group',
                    key: 'dependent.relationship',
                    semanticKey: 'person.dependentRelationship',
                    options: [
                      { value: 'child', label: 'Child' },
                      { value: 'spouse', label: 'Spouse' },
                    ],
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const snapshot = {
      view,
      data: {
        values: {},
      },
    };

    const appliedParts: Array<{ streamId: string; part: unknown }> = [];
    const beginStream = vi.fn(function (
      this: { sessionId: string },
      options: unknown
    ) {
      return {
        streamId: `${this.sessionId}-stream`,
        options,
      };
    });
    const applyStreamPart = vi.fn(function (
      this: { sessionId: string },
      streamId: string,
      part: unknown
    ) {
      appliedParts.push({
        streamId,
        part,
      });

      return `${this.sessionId}:${streamId}`;
    });
    const commitStream = vi.fn(function () {
      return {
        status: 'committed',
      };
    });

    const rawSession = {
      sessionId: 'session-3',
      getSnapshot: () => snapshot,
      getCommittedSnapshot: () => snapshot,
      getDetachedValues: () => ({}),
      getIssues: () => [],
      pushView: vi.fn(),
      beginStream,
      applyStreamPart,
      commitStream,
      getPendingProposals: () => ({}),
      acceptProposal: vi.fn(),
      rejectProposal: vi.fn(),
      rewind: vi.fn(),
      reset: vi.fn(),
      updateState: vi.fn(),
      proposeValue: vi.fn(),
    };

    const session = createContinuumSessionAdapter(rawSession);

    const generate = vi
      .fn()
      .mockResolvedValueOnce({
        text: JSON.stringify({
          mode: 'state',
          fallback: 'view',
          reason: 'fill dependents',
          targetSemanticKeys: ['person.dependents'],
        }),
      })
      .mockResolvedValueOnce({
        text: JSON.stringify({
          updates: [
            {
              semanticKey: 'person.dependents',
              value: {
                items: [
                  {
                    values: {
                      'dependent/name': 'Ava',
                      'person.dependentRelationship': 'Child',
                    },
                  },
                ],
              },
            },
          ],
          status: 'Updated dependents',
        }),
      });

    const result = await runContinuumExecution({
      adapter: {
        label: 'OpenAI',
        generate,
      },
      context: buildContinuumExecutionContext(session),
      instruction: 'Add one dependent named Ava',
      mode: 'create-view',
      autoApplyView: true,
    });

    applyContinuumExecutionFinalResult(session, result);

    expect(generate).toHaveBeenCalledTimes(2);
    expect(beginStream).toHaveBeenCalledWith({
      targetViewId: 'household',
      source: 'OpenAI',
      mode: 'foreground',
      supersede: true,
      baseViewVersion: '1',
    });
    expect(applyStreamPart).toHaveBeenCalledTimes(1);
    expect(commitStream).toHaveBeenCalledWith('session-3-stream');
    expect(appliedParts).toEqual([
      {
        streamId: 'session-3-stream',
        part: {
          kind: 'state',
          nodeId: 'household_group/dependents',
          value: {
            value: {
              items: [
                {
                  values: {
                    'dependent/name': { value: 'Ava' },
                    'dependent/relationship': { value: 'child' },
                  },
                },
              ],
            },
          },
          source: 'OpenAI',
        },
      },
    ]);
    expect(result).toMatchObject({
      status: 'Updated dependents',
      parsed: {
        updates: [
          {
            nodeId: 'household_group/dependents',
          },
        ],
      },
    });
  });
});
