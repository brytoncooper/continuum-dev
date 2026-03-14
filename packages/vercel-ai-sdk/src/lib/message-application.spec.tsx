import React, { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { createUIMessageStream } from 'ai';
import { createSession } from '@continuum-dev/session';
import type { ViewDefinition } from '@continuum-dev/contract';
import {
  applyContinuumVercelAiSdkMessage,
  createContinuumVercelAiSdkPatchDataChunk,
  createContinuumVercelAiSdkSessionAdapter,
  createContinuumVercelAiSdkStatusDataChunk,
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

describe('@continuum-dev/vercel-ai-sdk', () => {
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
      source: 'vercel-ai-sdk',
    });
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
});
