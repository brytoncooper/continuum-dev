import type { ViewDefinition } from '@continuum-dev/core';
import {
  applyPatchPlanThroughUpdateParts,
  applyStateUpdatesThroughStreamingFoundation,
  applyThroughStreamingFoundation,
} from './apply.js';

function createView(): ViewDefinition {
  return {
    viewId: 'profile',
    version: '1',
    nodes: [
      {
        id: 'profile_group',
        type: 'group',
        label: 'Profile',
        children: [
          {
            id: 'email',
            type: 'field',
            key: 'person.email',
            semanticKey: 'person.email',
            label: 'Email',
            dataType: 'string',
          },
        ],
      },
    ],
  };
}

describe('view generation apply helpers', () => {
  it('returns false when the streaming foundation is unavailable', () => {
    const session = {
      getSnapshot: () => ({
        view: createView(),
        data: { values: {} },
      }),
      getCommittedSnapshot: () => undefined,
    };

    expect(
      applyThroughStreamingFoundation(session as never, 'OpenAI', 'profile', [])
    ).toBe(false);
  });

  it('streams parts against the committed base view version when available', () => {
    const beginStream = vi.fn(() => ({ streamId: 'stream-1' }));
    const applyStreamPart = vi.fn();
    const commitStream = vi.fn(() => ({ status: 'committed' }));
    const session = {
      getSnapshot: () => ({
        view: createView(),
        data: { values: {} },
      }),
      getCommittedSnapshot: () => ({
        view: {
          ...createView(),
          version: '7',
        },
        data: { values: {} },
      }),
      beginStream,
      applyStreamPart,
      commitStream,
    };

    const result = applyThroughStreamingFoundation(
      session as never,
      'OpenAI',
      'profile',
      [
        {
          kind: 'state',
          nodeId: 'profile_group/email',
          value: { value: 'jordan@example.com' },
          source: 'OpenAI',
        },
      ] as never[],
      'draft'
    );

    expect(result).toBe(true);
    expect(beginStream).toHaveBeenCalledWith({
      targetViewId: 'profile',
      source: 'OpenAI',
      mode: 'draft',
      supersede: true,
      baseViewVersion: '7',
    });
    expect(applyStreamPart).toHaveBeenCalledWith('stream-1', {
      kind: 'state',
      nodeId: 'profile_group/email',
      value: { value: 'jordan@example.com' },
      source: 'OpenAI',
    });
    expect(commitStream).toHaveBeenCalledWith('stream-1');
  });

  it('throws when the streaming foundation refuses the commit', () => {
    const session = {
      getSnapshot: () => ({
        view: createView(),
        data: { values: {} },
      }),
      getCommittedSnapshot: () => undefined,
      beginStream: () => ({ streamId: 'stream-1' }),
      applyStreamPart: vi.fn(),
      commitStream: () => ({
        status: 'aborted',
        reason: 'conflict',
      }),
    };

    expect(() =>
      applyThroughStreamingFoundation(session as never, 'OpenAI', 'profile', [])
    ).toThrow(
      'Continuum stream commit failed with status "aborted": conflict.'
    );
  });

  it('converts state updates into streaming state parts', () => {
    const applyStreamPart = vi.fn();
    const session = {
      getSnapshot: () => ({
        view: createView(),
        data: { values: {} },
      }),
      getCommittedSnapshot: () => undefined,
      beginStream: () => ({ streamId: 'stream-1' }),
      applyStreamPart,
      commitStream: () => ({ status: 'committed' }),
    };

    expect(
      applyStateUpdatesThroughStreamingFoundation(
        session as never,
        'OpenAI',
        createView(),
        [
          {
            nodeId: 'profile_group/email',
            value: { value: 'jordan@example.com' },
          },
        ]
      )
    ).toBe(true);

    expect(applyStreamPart).toHaveBeenCalledWith('stream-1', {
      kind: 'state',
      nodeId: 'profile_group/email',
      value: { value: 'jordan@example.com' },
      source: 'OpenAI',
    });
  });

  it('returns false for non-patch plans or empty patch operations', () => {
    const session = {
      applyView: vi.fn(),
    };

    expect(
      applyPatchPlanThroughUpdateParts(
        session as never,
        'OpenAI',
        createView(),
        { mode: 'full', operations: [] }
      )
    ).toBe(false);

    expect(
      applyPatchPlanThroughUpdateParts(
        session as never,
        'OpenAI',
        createView(),
        { mode: 'patch', operations: [] }
      )
    ).toBe(false);
  });

  it('falls back to applyView when streaming is unavailable for patch plans', () => {
    const applyView = vi.fn();
    const session = {
      applyView,
    };

    const result =       applyPatchPlanThroughUpdateParts(
        session as never,
        'OpenAI',
        createView(),
        {
        operations: [
          {
            kind: 'insert-node',
            parentId: 'profile_group',
            position: { afterId: 'email' },
            node: {
              id: 'phone',
              type: 'field',
              key: 'person.phone',
              semanticKey: 'person.phone',
              label: 'Phone',
              dataType: 'string',
            },
          },
        ],
      }
    );

    expect(result).toBe(true);
    expect(applyView).toHaveBeenCalledTimes(1);
    expect(applyView.mock.calls[0][0]).toMatchObject({
      viewId: 'profile',
      version: '2',
      nodes: [
        {
          id: 'profile_group',
          children: [{ id: 'email' }, { id: 'phone', key: 'person.phone' }],
        },
      ],
    });
  });
});
