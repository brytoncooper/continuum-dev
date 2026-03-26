import React, { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { createUIMessageStream } from 'ai';
import { createSession, type ViewDefinition } from '@continuum-dev/core';
import {
  createContinuumVercelAiSdkAppendContentDataChunk,
  createContinuumVercelAiSdkInsertNodeDataChunk,
  createContinuumVercelAiSdkNodeStatusDataChunk,
  applyContinuumVercelAiSdkDataPart,
  applyContinuumVercelAiSdkMessage,
  createContinuumVercelAiSdkPatchDataChunk,
  createContinuumVercelAiSdkStateDataChunk,
  createContinuumVercelAiSdkSessionAdapter,
  createContinuumVercelAiSdkStatusDataChunk,
  createContinuumVercelAiSdkViewDataChunk,
  useContinuumVercelAiSdkChat,
  type ContinuumVercelAiSdkMessage,
} from '../index.js';

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function renderIntoDom(element: React.ReactElement) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(element);
  });
  return {
    container,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

describe('@continuum-dev/vercel-ai-sdk-adapter', () => {
  it('applies view parts into a Continuum session', () => {
    const session = createSession();
    const adapter = createContinuumVercelAiSdkSessionAdapter(session);
    const nextView: ViewDefinition = {
      viewId: 'loan-form',
      version: '1',
      nodes: [{ id: 'email', type: 'field', dataType: 'string' }],
    };

    const message: ContinuumVercelAiSdkMessage = {
      id: 'assistant-1',
      role: 'assistant',
      metadata: {},
      parts: [
        {
          type: 'data-continuum-view',
          data: {
            view: nextView,
          },
        },
      ],
    };

    const applications = applyContinuumVercelAiSdkMessage(message, adapter);

    expect(applications).toHaveLength(1);
    expect(applications[0]?.kind).toBe('view');
    expect(session.getSnapshot()?.view.viewId).toBe('loan-form');
  });

  it('applies transform metadata with view parts through the session runtime path', () => {
    const session = createSession();
    session.pushView({
      viewId: 'tax-form',
      version: '1',
      nodes: [
        {
          id: 'tax_form',
          type: 'group',
          children: [
            {
              id: 'name_row',
              type: 'row',
              children: [
                {
                  id: 'first_name',
                  type: 'field',
                  dataType: 'string',
                  key: 'first_name',
                },
                {
                  id: 'last_name',
                  type: 'field',
                  dataType: 'string',
                  key: 'last_name',
                },
              ],
            },
          ],
        },
      ],
    });
    session.updateState('first_name', { value: 'Jordan', isDirty: true });
    session.updateState('last_name', { value: 'Lee', isDirty: true });

    const adapter = createContinuumVercelAiSdkSessionAdapter(session);
    const applications = applyContinuumVercelAiSdkMessage(
      {
        id: 'assistant-transform',
        role: 'assistant',
        metadata: {},
        parts: [
          {
            type: 'data-continuum-view',
            data: {
              view: {
                viewId: 'tax-form',
                version: '2',
                nodes: [
                  {
                    id: 'tax_form',
                    type: 'group',
                    children: [
                      {
                        id: 'full_name',
                        type: 'field',
                        dataType: 'string',
                        key: 'full_name',
                      },
                    ],
                  },
                ],
              },
              transformPlan: {
                operations: [
                  {
                    kind: 'merge',
                    sourceNodeIds: ['first_name', 'last_name'],
                    targetNodeId: 'full_name',
                    strategyId: 'concat-space',
                  },
                ],
              },
            },
          },
        ],
      },
      adapter
    );

    expect(applications).toHaveLength(1);
    expect(session.getSnapshot()?.data.values['tax_form/full_name']).toEqual({
      value: 'Jordan Lee',
      isDirty: true,
    });
  });

  it('applies patch parts into the current Continuum session view', () => {
    const session = createSession();
    session.pushView({
      viewId: 'loan-form',
      version: '1',
      nodes: [
        {
          id: 'profile',
          type: 'group',
          children: [{ id: 'email', type: 'field', dataType: 'string' }],
        },
      ],
    });

    const adapter = createContinuumVercelAiSdkSessionAdapter(session);
    const message: ContinuumVercelAiSdkMessage = {
      id: 'assistant-2',
      role: 'assistant',
      metadata: {},
      parts: [
        {
          type: 'data-continuum-patch',
          data: {
            patch: {
              version: '2',
              operations: [
                {
                  op: 'insert-node',
                  parentId: 'profile',
                  position: { afterId: 'email' },
                  node: {
                    id: 'secondary_email',
                    type: 'field',
                    dataType: 'string',
                    label: 'Secondary email',
                  },
                },
              ],
            },
          },
        },
      ],
    };

    const applications = applyContinuumVercelAiSdkMessage(message, adapter);

    expect(applications).toHaveLength(1);
    expect(applications[0]?.kind).toBe('patch');
    const profile = session.getSnapshot()?.view.nodes[0] as {
      children: Array<{ id: string }>;
    };
    expect(profile.children.map((child) => child.id)).toEqual([
      'email',
      'secondary_email',
    ]);
  });

  it('routes AI state parts through proposals for dirty fields', () => {
    const session = createSession();
    session.pushView({
      viewId: 'loan-form',
      version: '1',
      nodes: [{ id: 'email', type: 'field', dataType: 'string' }],
    });
    session.updateState('email', { value: 'user@example.com', isDirty: true });

    const adapter = createContinuumVercelAiSdkSessionAdapter(session);
    const message: ContinuumVercelAiSdkMessage = {
      id: 'assistant-3',
      role: 'assistant',
      metadata: {},
      parts: [
        {
          type: 'data-continuum-state',
          data: {
            nodeId: 'email',
            value: { value: 'ai@example.com' },
          },
        },
      ],
    };

    const applications = applyContinuumVercelAiSdkMessage(message, adapter);

    expect(applications).toHaveLength(1);
    expect(applications[0]?.kind).toBe('state');
    expect(session.getSnapshot()?.data.values.email).toEqual({
      value: 'user@example.com',
      isDirty: true,
    });
    expect(session.getPendingProposals().email).toMatchObject({
      proposedValue: { value: 'ai@example.com' },
      currentValue: { value: 'user@example.com', isDirty: true },
      source: 'vercel-ai-sdk-adapter',
    });
  });

  it('streams transient parts into the render snapshot before committing durable state', () => {
    const session = createSession();
    session.pushView({
      viewId: 'loan-form',
      version: '1',
      nodes: [],
    });

    const adapter = createContinuumVercelAiSdkSessionAdapter(session);

    const transientPatchApplication = applyContinuumVercelAiSdkDataPart(
      {
        type: 'data-continuum-patch',
        transient: true,
        data: {
          patch: {
            viewId: 'loan-form',
            version: '2',
            operations: [
              {
                op: 'insert-node',
                parentId: null,
                node: {
                  id: 'name',
                  type: 'field',
                  dataType: 'string',
                },
              },
            ],
          },
        },
      },
      adapter
    );

    expect(transientPatchApplication.kind).toBe('patch');
    expect(session.getSnapshot()?.view.version).toBe('1.1');
    expect(session.getCommittedSnapshot()?.view.version).toBe('1');

    const streamId =
      'streamId' in transientPatchApplication
        ? transientPatchApplication.streamId
        : undefined;
    expect(typeof streamId).toBe('string');

    if (!streamId) {
      throw new Error('Expected transient patch to create a stream id');
    }

    adapter.commitStream?.(streamId);

    expect(session.getCommittedSnapshot()?.view.version).toBe('1.1');
  });

  it('keeps streamed patch chunks in the same assistant turn on one minor version', () => {
    const session = createSession();
    session.pushView({
      viewId: 'loan-form',
      version: '2',
      nodes: [
        {
          id: 'profile',
          type: 'group',
          children: [{ id: 'name', type: 'field', dataType: 'string' }],
        },
      ],
    });
    const adapter = createContinuumVercelAiSdkSessionAdapter(session);

    const firstPatch = applyContinuumVercelAiSdkDataPart(
      createContinuumVercelAiSdkPatchDataChunk({
        patch: {
          viewId: 'loan-form',
          version: '2.1',
          operations: [
            {
              op: 'insert-node',
              parentId: 'profile',
              position: { afterId: 'name' },
              node: {
                id: 'email',
                type: 'field',
                dataType: 'string',
              },
            },
          ],
        },
      }),
      adapter
    );

    const secondPatch = applyContinuumVercelAiSdkDataPart(
      createContinuumVercelAiSdkPatchDataChunk({
        patch: {
          viewId: 'loan-form',
          version: '2.2',
          operations: [
            {
              op: 'insert-node',
              parentId: 'profile',
              position: { afterId: 'email' },
              node: {
                id: 'phone',
                type: 'field',
                dataType: 'string',
              },
            },
          ],
        },
      }),
      adapter
    );

    const streamId =
      'streamId' in firstPatch ? firstPatch.streamId : undefined;
    expect(streamId).toBeTruthy();
    expect(
      'streamId' in secondPatch ? secondPatch.streamId : undefined
    ).toBe(streamId);
    expect(session.getSnapshot()?.view.version).toBe('2.1');

    if (!streamId) {
      throw new Error('Expected streamed patches to reuse a stream id');
    }

    adapter.commitStream?.(streamId);

    expect(session.getCommittedSnapshot()?.view.version).toBe('2.1');
  });

  it('keeps transient state chunks on render-only nodes out of committed state until commit', () => {
    const session = createSession();
    session.pushView({
      viewId: 'streamed-view',
      version: '1',
      nodes: [],
    });
    const adapter = createContinuumVercelAiSdkSessionAdapter(session);

    const transientViewApplication = applyContinuumVercelAiSdkDataPart(
      createContinuumVercelAiSdkViewDataChunk(
        {
          view: {
            viewId: 'streamed-view',
            version: '2',
            nodes: [
              {
                id: 'name',
                type: 'field',
                dataType: 'string',
              },
            ],
          },
        },
        { transient: true }
      ),
      adapter
    );

    const streamId =
      'streamId' in transientViewApplication
        ? transientViewApplication.streamId
        : undefined;
    if (!streamId) {
      throw new Error('Expected transient view to create a stream id');
    }

    applyContinuumVercelAiSdkDataPart(
      createContinuumVercelAiSdkStateDataChunk(
        {
          nodeId: 'name',
          value: { value: 'typed', isDirty: true },
        },
        { transient: true }
      ),
      adapter
    );

    expect(session.getSnapshot()?.data.values['name']).toEqual({
      value: 'typed',
      isDirty: true,
    });
    expect(session.getCommittedSnapshot()?.data.values['name']).toBeUndefined();

    adapter.commitStream?.(streamId);

    expect(session.getCommittedSnapshot()?.data.values['name']).toEqual({
      value: 'typed',
      isDirty: true,
    });
  });

  it('routes draft view chunks through a draft stream and commits only when the turn finishes', () => {
    const session = createSession();
    session.pushView({
      viewId: 'drafted-view',
      version: '1',
      nodes: [
        {
          id: 'email',
          type: 'field',
          dataType: 'string',
          semanticKey: 'person.email',
        },
      ],
    });
    const adapter = createContinuumVercelAiSdkSessionAdapter(session);

    const previewApplication = applyContinuumVercelAiSdkDataPart(
      createContinuumVercelAiSdkViewDataChunk(
        {
          view: {
            viewId: 'drafted-view',
            version: '2',
            nodes: [
              {
                id: 'contact_row',
                type: 'row',
                children: [
                  {
                    id: 'email',
                    type: 'field',
                    dataType: 'string',
                    semanticKey: 'person.email',
                  },
                  {
                    id: 'phone',
                    type: 'field',
                    dataType: 'string',
                    semanticKey: 'person.phone',
                  },
                ],
              },
            ],
          },
        },
        { transient: true, streamMode: 'draft' }
      ),
      adapter
    );

    const previewStreamId =
      'streamId' in previewApplication
        ? previewApplication.streamId
        : undefined;
    if (!previewStreamId) {
      throw new Error('Expected transient draft view to create a stream id');
    }

    expect(session.getSnapshot()?.view.version).toBe('1');
    expect(session.getCommittedSnapshot()?.view.version).toBe('1');
    expect(session.getStreams()[0]?.mode).toBe('draft');
    expect(session.getStreams()[0]?.status).toBe('open');
    expect(session.getStreams()[0]?.previewView?.version).toBe('2');

    const finalApplication = applyContinuumVercelAiSdkDataPart(
      createContinuumVercelAiSdkViewDataChunk(
        {
          view: {
            viewId: 'drafted-view',
            version: '2',
            nodes: [
              {
                id: 'contact_row',
                type: 'row',
                children: [
                  {
                    id: 'email',
                    type: 'field',
                    dataType: 'string',
                    semanticKey: 'person.email',
                  },
                  {
                    id: 'phone',
                    type: 'field',
                    dataType: 'string',
                    semanticKey: 'person.phone',
                  },
                ],
              },
            ],
          },
        },
        { streamMode: 'draft' }
      ),
      adapter
    );

    expect(
      'streamId' in finalApplication ? finalApplication.streamId : undefined
    ).toBe(previewStreamId);
    expect(session.getStreams()[0]?.status).toBe('open');
    expect(session.getStreams()[0]?.mode).toBe('draft');
    expect(session.getStreams()[0]?.previewView?.version).toBe('2');

    adapter.commitStream?.(previewStreamId);

    expect(session.getSnapshot()?.view.version).toBe('2');
    expect(session.getCommittedSnapshot()?.view.version).toBe('2');
    expect(session.getStreams()[0]?.status).toBe('committed');
  });

  it('keeps transient status updates on the active draft stream instead of superseding it', () => {
    const session = createSession();
    session.pushView({
      viewId: 'drafted-view',
      version: '1',
      nodes: [],
    });
    const adapter = createContinuumVercelAiSdkSessionAdapter(session);

    const previewApplication = applyContinuumVercelAiSdkDataPart(
      createContinuumVercelAiSdkViewDataChunk(
        {
          view: {
            viewId: 'drafted-view',
            version: '2',
            nodes: [
              {
                id: 'email',
                type: 'field',
                dataType: 'string',
                semanticKey: 'person.email',
              },
            ],
          },
        },
        { transient: true, streamMode: 'draft' }
      ),
      adapter
    );

    const draftStreamId =
      'streamId' in previewApplication
        ? previewApplication.streamId
        : undefined;
    if (!draftStreamId) {
      throw new Error('Expected transient draft view to create a stream id');
    }

    const statusApplication = applyContinuumVercelAiSdkDataPart(
      createContinuumVercelAiSdkStatusDataChunk(
        {
          status: 'Still building...',
          level: 'info',
        },
        { transient: true }
      ),
      adapter
    );

    expect(statusApplication.kind).toBe('status');
    expect(
      'streamId' in statusApplication ? statusApplication.streamId : undefined
    ).toBe(draftStreamId);
    expect(session.getStreams()).toHaveLength(1);
    expect(session.getStreams()[0]?.mode).toBe('draft');
    expect(session.getStreams()[0]?.status).toBe('open');
    expect(session.getStreams()[0]?.previewView?.version).toBe('2');
  });

  it('applies richer stream parts and exposes node-status metadata', () => {
    const session = createSession();
    session.pushView({
      viewId: 'streamed-view',
      version: '1',
      nodes: [
        {
          id: 'intro',
          type: 'presentation',
          contentType: 'text',
          content: 'Hello',
        },
      ],
    });
    const adapter = createContinuumVercelAiSdkSessionAdapter(session);

    const inserted = applyContinuumVercelAiSdkDataPart(
      createContinuumVercelAiSdkInsertNodeDataChunk(
        {
          targetViewId: 'streamed-view',
          parentId: null,
          node: {
            id: 'name',
            type: 'field',
            dataType: 'string',
          },
        },
        { transient: true }
      ),
      adapter
    );
    const streamId = 'streamId' in inserted ? inserted.streamId : undefined;
    if (!streamId) {
      throw new Error('Expected transient insert-node to create a stream id');
    }

    applyContinuumVercelAiSdkDataPart(
      createContinuumVercelAiSdkAppendContentDataChunk(
        {
          targetViewId: 'streamed-view',
          nodeId: 'intro',
          text: ' world',
        },
        { transient: true }
      ),
      adapter
    );

    applyContinuumVercelAiSdkDataPart(
      createContinuumVercelAiSdkNodeStatusDataChunk(
        {
          targetViewId: 'streamed-view',
          nodeId: 'name',
          status: 'ready',
          level: 'success',
        },
        { transient: true }
      ),
      adapter
    );

    expect(session.getSnapshot()?.view.nodes).toHaveLength(2);
    expect(session.getCommittedSnapshot()?.view.nodes).toHaveLength(1);
    expect(session.getStreams()[0]?.nodeStatuses['name']).toEqual({
      status: 'ready',
      level: 'success',
    });
    expect(
      (
        session.getSnapshot()?.view.nodes[0] as Extract<
          ViewDefinition['nodes'][number],
          { type: 'presentation' }
        >
      ).content
    ).toBe('Hello world');

    adapter.commitStream?.(streamId);

    expect(session.getCommittedSnapshot()?.view.nodes).toHaveLength(2);
  });

  it('syncs AI SDK UI assistant messages into the session and exposes transient status updates', async () => {
    const session = createSession();
    session.pushView({
      viewId: 'streamed-view',
      version: '1',
      nodes: [],
    });
    let capturedStatus = '';
    let sendMessage:
      | ReturnType<
          typeof useContinuumVercelAiSdkChat<ContinuumVercelAiSdkMessage>
        >['sendMessage']
      | null = null;

    const streamedView: ViewDefinition = {
      viewId: 'streamed-view',
      version: '2',
      nodes: [{ id: 'name', type: 'field', dataType: 'string', label: 'Name' }],
    };

    function Probe() {
      const chat = useContinuumVercelAiSdkChat<ContinuumVercelAiSdkMessage>({
        session,
        transport: {
          async sendMessages() {
            return createUIMessageStream<ContinuumVercelAiSdkMessage>({
              execute: ({ writer }) => {
                writer.write(
                  createContinuumVercelAiSdkStatusDataChunk(
                    {
                      status: 'Applying Continuum update...',
                      level: 'info',
                    },
                    { transient: true }
                  )
                );
                writer.write(
                  createContinuumVercelAiSdkPatchDataChunk({
                    patch: {
                      viewId: 'streamed-view',
                      version: '2',
                      operations: [
                        {
                          op: 'insert-node',
                          parentId: null,
                          node: streamedView.nodes[0],
                        },
                      ],
                    },
                  })
                );
              },
            });
          },
          async reconnectToStream() {
            return null;
          },
        },
      });

      sendMessage = chat.sendMessage;

      useEffect(() => {
        capturedStatus = chat.latestStatus?.status ?? '';
      }, [chat.latestStatus]);

      return null;
    }

    const rendered = renderIntoDom(<Probe />);

    await act(async () => {
      await sendMessage?.({ text: 'Build a new form' });
      await flushMicrotasks();
      await flushMicrotasks();
    });

    expect(capturedStatus).toBe('Applying Continuum update...');
    expect(session.getSnapshot()?.view.viewId).toBe('streamed-view');

    rendered.unmount();
  });

  it('creates one committed checkpoint for multiple streamed mutations in a single assistant reply', async () => {
    const session = createSession();
    session.pushView({
      viewId: 'streamed-view',
      version: '2',
      nodes: [
        {
          id: 'profile',
          type: 'group',
          children: [{ id: 'name', type: 'field', dataType: 'string' }],
        },
      ],
    });

    const initialCheckpointCount = session.getCheckpoints().length;
    let sendMessage:
      | ReturnType<
          typeof useContinuumVercelAiSdkChat<ContinuumVercelAiSdkMessage>
        >['sendMessage']
      | null = null;

    function Probe() {
      const chat = useContinuumVercelAiSdkChat<ContinuumVercelAiSdkMessage>({
        session,
        transport: {
          async sendMessages() {
            return createUIMessageStream<ContinuumVercelAiSdkMessage>({
              execute: ({ writer }) => {
                writer.write(
                  createContinuumVercelAiSdkPatchDataChunk({
                    patch: {
                      viewId: 'streamed-view',
                      version: '2.1',
                      operations: [
                        {
                          op: 'insert-node',
                          parentId: 'profile',
                          position: { afterId: 'name' },
                          node: {
                            id: 'email',
                            type: 'field',
                            dataType: 'string',
                            label: 'Email',
                          },
                        },
                      ],
                    },
                  })
                );
                writer.write(
                  createContinuumVercelAiSdkPatchDataChunk({
                    patch: {
                      viewId: 'streamed-view',
                      version: '2.2',
                      operations: [
                        {
                          op: 'insert-node',
                          parentId: 'profile',
                          position: { afterId: 'email' },
                          node: {
                            id: 'phone',
                            type: 'field',
                            dataType: 'string',
                            label: 'Phone',
                          },
                        },
                      ],
                    },
                  })
                );
              },
            });
          },
          async reconnectToStream() {
            return null;
          },
        },
      });

      sendMessage = chat.sendMessage;
      return null;
    }

    const rendered = renderIntoDom(<Probe />);

    await act(async () => {
      await sendMessage?.({ text: 'Add contact fields' });
      await flushMicrotasks();
      await flushMicrotasks();
    });

    const profile = session.getSnapshot()?.view.nodes[0] as {
      children: Array<{ id: string }>;
    };
    expect(profile.children.map((child) => child.id)).toEqual([
      'name',
      'email',
      'phone',
    ]);
    expect(session.getCommittedSnapshot()?.view.version).toBe('2.1');
    expect(session.getCheckpoints()).toHaveLength(initialCheckpointCount + 1);

    rendered.unmount();
  });

  it('does not create a checkpoint for status-only assistant turns', async () => {
    const session = createSession();
    session.pushView({
      viewId: 'streamed-view',
      version: '1',
      nodes: [],
    });

    const initialCheckpointCount = session.getCheckpoints().length;
    let sendMessage:
      | ReturnType<
          typeof useContinuumVercelAiSdkChat<ContinuumVercelAiSdkMessage>
        >['sendMessage']
      | null = null;

    function Probe() {
      const chat = useContinuumVercelAiSdkChat<ContinuumVercelAiSdkMessage>({
        session,
        transport: {
          async sendMessages() {
            return createUIMessageStream<ContinuumVercelAiSdkMessage>({
              execute: ({ writer }) => {
                writer.write(
                  createContinuumVercelAiSdkStatusDataChunk(
                    {
                      status: 'Thinking...',
                      level: 'info',
                    },
                    { transient: true }
                  )
                );
              },
            });
          },
          async reconnectToStream() {
            return null;
          },
        },
      });

      sendMessage = chat.sendMessage;
      return null;
    }

    const rendered = renderIntoDom(<Probe />);

    await act(async () => {
      await sendMessage?.({ text: 'Just narrate progress' });
      await flushMicrotasks();
      await flushMicrotasks();
    });

    expect(session.getCommittedSnapshot()?.view.version).toBe('1');
    expect(session.getCheckpoints()).toHaveLength(initialCheckpointCount);
    expect(
      session.getStreams().some((stream) => stream.status === 'open')
    ).toBe(false);

    rendered.unmount();
  });

  it('applies transient preview views before the stream finishes and commits the final view afterward', async () => {
    const session = createSession();
    session.pushView({
      viewId: 'streamed-view',
      version: '1',
      nodes: [],
    });
    const initialCheckpointCount = session.getCheckpoints().length;

    let sendMessage:
      | ReturnType<
          typeof useContinuumVercelAiSdkChat<ContinuumVercelAiSdkMessage>
        >['sendMessage']
      | null = null;
    let releaseFinalView: (() => void) | null = null;
    const finalViewReady = new Promise<void>((resolve) => {
      releaseFinalView = resolve;
    });

    const previewView: ViewDefinition = {
      viewId: 'streamed-view',
      version: 'preview',
      nodes: [{ id: 'name', type: 'field', dataType: 'string', label: 'Name' }],
    };
    const finalView: ViewDefinition = {
      viewId: 'streamed-view',
      version: 'final',
      nodes: [
        { id: 'name', type: 'field', dataType: 'string', label: 'Name' },
        {
          id: 'email',
          type: 'field',
          dataType: 'string',
          label: 'Email',
        },
      ],
    };

    function Probe() {
      const chat = useContinuumVercelAiSdkChat<ContinuumVercelAiSdkMessage>({
        session,
        transport: {
          async sendMessages() {
            return createUIMessageStream<ContinuumVercelAiSdkMessage>({
              execute: async ({ writer }) => {
                writer.write(
                  createContinuumVercelAiSdkViewDataChunk(
                    {
                      view: previewView,
                    },
                    { id: 'preview-view', transient: true }
                  )
                );
                await finalViewReady;
                writer.write(
                  createContinuumVercelAiSdkViewDataChunk(
                    {
                      view: finalView,
                    },
                    { id: 'final-view' }
                  )
                );
              },
            });
          },
          async reconnectToStream() {
            return null;
          },
        },
      });

      sendMessage = chat.sendMessage;
      return null;
    }

    const rendered = renderIntoDom(<Probe />);
    let inflightSend: Promise<void> | undefined;

    await act(async () => {
      inflightSend = sendMessage?.({ text: 'Build a new form' });
      await flushMicrotasks();
      await flushMicrotasks();
    });

    expect(session.getSnapshot()?.view.version).toBe('preview');
    expect(session.getCommittedSnapshot()?.view.version).toBe('1');

    await act(async () => {
      releaseFinalView?.();
      await inflightSend;
      await flushMicrotasks();
      await flushMicrotasks();
    });

    expect(session.getSnapshot()?.view.version).toBe('final');
    expect(session.getCommittedSnapshot()?.view.version).toBe('final');
    expect(session.getCheckpoints()).toHaveLength(initialCheckpointCount + 1);

    rendered.unmount();
  });

  it('abandons preview-only streams when the assistant turn errors', async () => {
    const session = createSession();
    session.pushView({
      viewId: 'streamed-view',
      version: '1',
      nodes: [],
    });

    const initialCheckpointCount = session.getCheckpoints().length;
    let sendMessage:
      | ReturnType<
          typeof useContinuumVercelAiSdkChat<ContinuumVercelAiSdkMessage>
        >['sendMessage']
      | null = null;

    function Probe() {
      const chat = useContinuumVercelAiSdkChat<ContinuumVercelAiSdkMessage>({
        session,
        onError: () => undefined,
        transport: {
          async sendMessages() {
            return createUIMessageStream<ContinuumVercelAiSdkMessage>({
              execute: async ({ writer }) => {
                writer.write(
                  createContinuumVercelAiSdkViewDataChunk(
                    {
                      view: {
                        viewId: 'streamed-view',
                        version: 'preview',
                        nodes: [
                          {
                            id: 'name',
                            type: 'field',
                            dataType: 'string',
                            label: 'Name',
                          },
                        ],
                      },
                    },
                    { transient: true, id: 'preview-only' }
                  )
                );
                throw new Error('stream failed');
              },
            });
          },
          async reconnectToStream() {
            return null;
          },
        },
      });

      sendMessage = chat.sendMessage;
      return null;
    }

    const rendered = renderIntoDom(<Probe />);

    await act(async () => {
      await sendMessage?.({ text: 'Start previewing and fail' }).catch(
        () => undefined
      );
      await flushMicrotasks();
      await flushMicrotasks();
    });

    expect(session.getSnapshot()?.view.version).toBe('1');
    expect(session.getCommittedSnapshot()?.view.version).toBe('1');
    expect(session.getCheckpoints()).toHaveLength(initialCheckpointCount);
    expect(
      session.getStreams().some((stream) => stream.status === 'open')
    ).toBe(false);

    rendered.unmount();
  });

  it('restarts from the committed base when a final transform follows a transient preview view', () => {
    const session = createSession();
    session.pushView({
      viewId: 'tax-form',
      version: '3',
      nodes: [
        {
          id: 'tax_form',
          type: 'group',
          children: [
            {
              id: 'full_name',
              type: 'field',
              dataType: 'string',
              key: 'full_name',
              label: 'Full name',
            },
          ],
        },
      ],
    });
    session.updateState('full_name', { value: 'Jordan Lee', isDirty: true });

    const adapter = createContinuumVercelAiSdkSessionAdapter(session);
    const previewApplication = applyContinuumVercelAiSdkDataPart(
      createContinuumVercelAiSdkViewDataChunk(
        {
          view: {
            viewId: 'tax-form',
            version: '4-preview',
            nodes: [
              {
                id: 'tax_form',
                type: 'group',
                children: [
                  {
                    id: 'name_row',
                    type: 'row',
                    children: [
                      {
                        id: 'first_name',
                        type: 'field',
                        dataType: 'string',
                        key: 'first_name',
                        label: 'First name',
                      },
                      {
                        id: 'last_name',
                        type: 'field',
                        dataType: 'string',
                        key: 'last_name',
                        label: 'Last name',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        },
        { transient: true }
      ),
      adapter
    );

    const previewStreamId =
      'streamId' in previewApplication
        ? previewApplication.streamId
        : undefined;
    if (!previewStreamId) {
      throw new Error('Expected transient preview to create a stream id');
    }

    const finalApplication = applyContinuumVercelAiSdkDataPart(
      createContinuumVercelAiSdkViewDataChunk({
        view: {
          viewId: 'tax-form',
          version: '4',
          nodes: [
            {
              id: 'tax_form',
              type: 'group',
              children: [
                {
                  id: 'name_row',
                  type: 'row',
                  children: [
                    {
                      id: 'first_name',
                      type: 'field',
                      dataType: 'string',
                      key: 'first_name',
                      label: 'First name',
                    },
                    {
                      id: 'last_name',
                      type: 'field',
                      dataType: 'string',
                      key: 'last_name',
                      label: 'Last name',
                    },
                  ],
                },
              ],
            },
          ],
        },
        transformPlan: {
          operations: [
            {
              kind: 'split',
              sourceNodeId: 'full_name',
              targetNodeIds: ['first_name', 'last_name'],
              strategyId: 'split-space',
            },
          ],
        },
      }),
      adapter
    );

    expect(finalApplication.kind).toBe('view');
    const finalStreamId =
      'streamId' in finalApplication ? finalApplication.streamId : undefined;
    expect(finalStreamId).not.toBe(previewStreamId);
    expect(session.getCommittedSnapshot()?.view.version).toBe('3');
    expect(
      session.getSnapshot()?.data.values['tax_form/name_row/first_name']
    ).toEqual({
      value: 'Jordan',
      isDirty: true,
    });
    expect(
      session.getSnapshot()?.data.values['tax_form/name_row/last_name']
    ).toEqual({
      value: 'Lee',
      isDirty: true,
    });
    expect(
      session.getStreams().find((stream) => stream.streamId === previewStreamId)
        ?.status
    ).toBe('superseded');

    if (!finalStreamId) {
      throw new Error('Expected final transform view to create a stream id');
    }

    adapter.commitStream?.(finalStreamId);

    expect(session.getCommittedSnapshot()?.view.version).toBe('3.1');
  });

  it('returns an ignored application instead of throwing when transform apply fails', () => {
    const session = createSession();
    session.pushView({
      viewId: 'tax-form',
      version: '1',
      nodes: [
        {
          id: 'tax_form',
          type: 'group',
          children: [
            {
              id: 'full_name',
              type: 'field',
              dataType: 'string',
              key: 'full_name',
            },
          ],
        },
      ],
    });

    const adapter = createContinuumVercelAiSdkSessionAdapter(session);
    const application = applyContinuumVercelAiSdkDataPart(
      createContinuumVercelAiSdkViewDataChunk({
        view: {
          viewId: 'tax-form',
          version: '2',
          nodes: [
            {
              id: 'tax_form',
              type: 'group',
              children: [
                {
                  id: 'name_row',
                  type: 'row',
                  children: [
                    {
                      id: 'first_name',
                      type: 'field',
                      dataType: 'string',
                      key: 'first_name',
                    },
                    {
                      id: 'last_name',
                      type: 'field',
                      dataType: 'string',
                      key: 'last_name',
                    },
                  ],
                },
              ],
            },
          ],
        },
        transformPlan: {
          operations: [
            {
              kind: 'split',
              sourceNodeId: 'missing_full_name',
              targetNodeIds: ['first_name', 'last_name'],
              strategyId: 'split-space',
            },
          ],
        },
      }),
      adapter
    );

    expect(application).toEqual(
      expect.objectContaining({
        kind: 'ignored',
        reason: expect.stringContaining(
          'Transform source node "missing_full_name" was not found in the prior view.'
        ),
      })
    );
    expect(session.getCommittedSnapshot()?.view.version).toBe('1');
  });
});
