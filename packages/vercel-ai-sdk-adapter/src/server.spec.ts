import { createUIMessageStreamResponse } from 'ai';
import * as aiEngine from '@continuum-dev/ai-engine';
import type { ContinuumExecutionAdapter } from '@continuum-dev/ai-engine';
import { describe, expect, it, vi } from 'vitest';
import {
  buildConversationTranscriptFromMessages,
  buildRouteContinuumExecutionContext,
  createContinuumUiMessageStream,
  createContinuumVercelAiSdkRouteHandler,
  extractChatAttachmentsFromMessages,
  writeContinuumExecutionToUiMessageWriter,
} from './server.js';

const generatedViewText = `view viewId="loan_form" version="1"
group id="loan_root" label="Loan form"
  field id="email" key="email" label="Email" dataType="string"`;

function createExecutionAdapter(): ContinuumExecutionAdapter {
  return {
    label: 'Fake AI SDK',
    async generate(request) {
      if (request.mode === 'planner') {
        return {
          text: JSON.stringify({
            mode: 'view',
            fallback: 'view',
            reason: 'test',
            authoringMode: 'create-view',
          }),
        };
      }

      if (request.mode === 'view') {
        return {
          text: generatedViewText,
          raw: generatedViewText,
        };
      }

      throw new Error(`Unexpected mode: ${request.mode}`);
    },
  };
}

function createPatchExecutionAdapter(): ContinuumExecutionAdapter {
  return {
    label: 'Fake AI SDK',
    async generate(request) {
      if (request.mode === 'planner') {
        return {
          text: JSON.stringify({
            mode: 'patch',
            fallback: 'view',
            reason: 'localized edit',
          }),
        };
      }

      if (request.mode === 'patch') {
        return {
          text: JSON.stringify({
            mode: 'patch',
            operations: [
              {
                kind: 'insert-node',
                parentId: 'loan_root',
                position: { afterId: 'email' },
                node: {
                  id: 'phone',
                  type: 'field',
                  key: 'phone',
                  label: 'Phone',
                  dataType: 'string',
                },
              },
            ],
          }),
        };
      }

      throw new Error(`Unexpected mode: ${request.mode}`);
    },
  };
}

function createTransformExecutionAdapter(): ContinuumExecutionAdapter {
  return {
    label: 'Fake AI SDK',
    async generate(request) {
      if (request.mode === 'planner') {
        return {
          text: JSON.stringify({
            mode: 'transform',
            fallback: 'view',
            reason: 'merge fields',
            targetNodeIds: ['name_row'],
          }),
        };
      }

      if (request.mode === 'view') {
        return {
          text: `view viewId="tax_form" version="2"
group id="tax_root" label="Tax form"
  field id="full_name" key="full_name" label="Full name" dataType="string"`,
        };
      }

      if (request.mode === 'transform') {
        return {
          text: JSON.stringify({
            patchOperations: [
              {
                kind: 'remove-node',
                nodeId: 'first_name',
              },
              {
                kind: 'remove-node',
                nodeId: 'last_name',
              },
              {
                kind: 'insert-node',
                parentId: 'name_row',
                node: {
                  id: 'full_name',
                  type: 'field',
                  key: 'full_name',
                  semanticKey: 'person.fullName',
                  label: 'Full name',
                  dataType: 'string',
                },
              },
            ],
            continuityOperations: [
              {
                kind: 'merge',
                sourceNodeIds: ['first_name', 'last_name'],
                targetNodeId: 'full_name',
                strategyId: 'concat-space',
              },
            ],
          }),
        };
      }

      throw new Error(`Unexpected mode: ${request.mode}`);
    },
  };
}

describe('@continuum-dev/vercel-ai-sdk-adapter/server', () => {
  it('writes Continuum UI parts into an existing writer', async () => {
    const chunks: Array<Record<string, unknown>> = [];
    const result = await writeContinuumExecutionToUiMessageWriter({
      writer: {
        write(chunk) {
          chunks.push(chunk as Record<string, unknown>);
        },
      } as never,
      adapter: createExecutionAdapter(),
      instruction: 'Build a loan intake form',
      authoringFormat: 'line-dsl',
    });

    expect(result.mode).toBe('view');
    expect(
      chunks.some(
        (chunk) =>
          chunk.type === 'data-continuum-view' &&
          (chunk.data as { view?: { viewId?: string } }).view?.viewId ===
            'loan_form'
      )
    ).toBe(true);
  });

  it('can stream view updates directly into the foreground session lane', async () => {
    const chunks: Array<Record<string, unknown>> = [];

    await writeContinuumExecutionToUiMessageWriter({
      writer: {
        write(chunk) {
          chunks.push(chunk as Record<string, unknown>);
        },
      } as never,
      adapter: createExecutionAdapter(),
      instruction: 'Build a loan intake form',
      authoringFormat: 'line-dsl',
      viewStreamMode: 'foreground',
    });

    expect(
      chunks.some(
        (chunk) =>
          chunk.type === 'data-continuum-view' &&
          (chunk.data as { streamMode?: string }).streamMode === 'foreground'
      )
    ).toBe(true);
  });

  it('writes transform metadata alongside final view updates', async () => {
    const chunks: Array<Record<string, unknown>> = [];

    const result = await writeContinuumExecutionToUiMessageWriter({
      writer: {
        write(chunk) {
          chunks.push(chunk as Record<string, unknown>);
        },
      } as never,
      adapter: createTransformExecutionAdapter(),
      executionMode: 'transform',
      instruction: 'Make first name and last name into full name.',
      context: {
        currentView: {
          viewId: 'tax_form',
          version: '1',
          nodes: [
            {
              id: 'tax_root',
              type: 'group',
              children: [
                {
                  id: 'name_row',
                  type: 'row',
                  children: [
                    {
                      id: 'first_name',
                      type: 'field',
                      key: 'first_name',
                      label: 'First name',
                      dataType: 'string',
                    },
                    {
                      id: 'last_name',
                      type: 'field',
                      key: 'last_name',
                      label: 'Last name',
                      dataType: 'string',
                    },
                  ],
                },
              ],
            },
          ],
        },
        currentData: {},
      },
      authoringFormat: 'line-dsl',
    });

    expect(result).toMatchObject({
      mode: 'transform',
      level: 'success',
    });
    expect(
      chunks.some(
        (chunk) =>
          chunk.type === 'data-continuum-view' &&
          Array.isArray(
            (chunk.data as { transformPlan?: { operations?: unknown[] } })
              .transformPlan?.operations
          )
      )
    ).toBe(true);
  });

  it('still emits localized patch parts when the patch plan is valid', async () => {
    const chunks: Array<Record<string, unknown>> = [];

    const result = await writeContinuumExecutionToUiMessageWriter({
      writer: {
        write(chunk) {
          chunks.push(chunk as Record<string, unknown>);
        },
      } as never,
      adapter: createPatchExecutionAdapter(),
      executionMode: 'patch',
      instruction: 'Add a phone field below email.',
      context: {
        currentView: {
          viewId: 'loan_form',
          version: '1',
          nodes: [
            {
              id: 'loan_root',
              type: 'group',
              children: [
                {
                  id: 'email',
                  type: 'field',
                  key: 'email',
                  label: 'Email',
                  dataType: 'string',
                },
              ],
            },
          ],
        },
        currentData: {},
      },
      authoringFormat: 'line-dsl',
    });

    expect(result).toMatchObject({
      mode: 'patch',
      level: 'success',
    });
    expect(chunks.some((chunk) => chunk.type === 'data-continuum-patch')).toBe(
      true
    );
  });

  it('downgrades zero-mutation patch streams to a warning instead of final success', async () => {
    const currentView = {
      viewId: 'loan_form',
      version: '1',
      nodes: [],
    };
    const patchPlan = {
      mode: 'patch',
      operations: [{ kind: 'unsupported-op' }],
    } as never;
    const streamSpy = vi
      .spyOn(aiEngine, 'streamContinuumExecution')
      .mockImplementation((() =>
        (async function* () {
          yield {
            kind: 'patch',
            currentView,
            patchPlan,
          } as never;

          return {
            mode: 'patch',
            source: 'Mock AI',
            status:
              'Applied localized Continuum patch operations from Mock AI.',
            level: 'success',
            trace: [],
            currentView,
            patchPlan,
            parsed: patchPlan,
          } as never;
        })()) as typeof aiEngine.streamContinuumExecution);

    try {
      const stream = createContinuumUiMessageStream({
        adapter: createExecutionAdapter(),
        instruction: 'No-op patch',
      });
      const response = createUIMessageStreamResponse({ stream });
      const body = await response.text();

      expect(body).toContain(
        'Patch update could not be applied; no changes were made.'
      );
      expect(body).toContain('"level":"warning"');
      expect(body).not.toContain('"level":"success"');
      expect(body).not.toContain('data-continuum-patch');
    } finally {
      streamSpy.mockRestore();
    }
  });

  it('keeps the convenience route helper working for simple routes', async () => {
    const handler = createContinuumVercelAiSdkRouteHandler({
      adapter: createExecutionAdapter(),
      defaultAuthoringFormat: 'line-dsl',
    });

    const response = await handler(
      new Request('http://localhost/api/chat', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: 'Build a loan intake form',
            },
          ],
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('x-vercel-ai-ui-message-stream')).toBe('v1');

    const body = await response.text();
    expect(body).toContain('data-continuum-view');
    expect(body).toContain('data-continuum-execution-trace');
    expect(body).toContain('loan_form');
  });

  it('derives conversation summary from prior chat messages for Continuum context', async () => {
    const streamSpy = vi
      .spyOn(aiEngine, 'streamContinuumExecution')
      .mockImplementation(async function* (args) {
        expect(args.context?.conversationSummary).toContain(
          'Prior conversation'
        );
        expect(args.context?.conversationSummary).toContain(
          'Harborline live UI'
        );
        expect(args.context?.conversationSummary).toContain(
          'Assistant: Understood.'
        );
        expect(args.context?.conversationSummary).not.toContain(
          'Update my profile'
        );
        yield {
          kind: 'status',
          status: 'done',
          level: 'info',
        } as never;
        return {
          mode: 'noop',
          source: 'test',
          status: 'noop',
          level: 'warning',
          trace: [],
          requestedMode: 'view',
          reason: 'test',
        } as never;
      } as typeof aiEngine.streamContinuumExecution);

    try {
      const handler = createContinuumVercelAiSdkRouteHandler({
        adapter: createExecutionAdapter(),
        defaultAuthoringFormat: 'line-dsl',
      });

      const response = await handler(
        new Request('http://localhost/api/chat', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            messages: [
              {
                role: 'user',
                content: 'Harborline live UI — describe workflows in chat.',
              },
              {
                role: 'assistant',
                content: 'Understood.',
              },
              {
                role: 'user',
                parts: [{ type: 'text', text: 'Update my profile' }],
              },
            ],
          }),
        })
      );

      expect(response.status).toBe(200);
      expect(streamSpy).toHaveBeenCalled();
    } finally {
      streamSpy.mockRestore();
    }
  });

  it('merges explicit conversationSummary with derived prior messages', async () => {
    const streamSpy = vi
      .spyOn(aiEngine, 'streamContinuumExecution')
      .mockImplementation(async function* (args) {
        const summary = args.context?.conversationSummary ?? '';
        expect(summary).toContain('Explicit bounded note.');
        expect(summary).toContain('Prior conversation');
        expect(summary).toContain('Earlier user line.');
        yield {
          kind: 'status',
          status: 'done',
          level: 'info',
        } as never;
        return {
          mode: 'noop',
          source: 'test',
          status: 'noop',
          level: 'warning',
          trace: [],
          requestedMode: 'view',
          reason: 'test',
        } as never;
      } as typeof aiEngine.streamContinuumExecution);

    try {
      const handler = createContinuumVercelAiSdkRouteHandler({
        adapter: createExecutionAdapter(),
        defaultAuthoringFormat: 'line-dsl',
      });

      const response = await handler(
        new Request('http://localhost/api/chat', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            conversationSummary: 'Explicit bounded note.',
            messages: [
              { role: 'user', content: 'Earlier user line.' },
              { role: 'assistant', content: 'Reply.' },
              { role: 'user', content: 'Latest instruction' },
            ],
          }),
        })
      );

      expect(response.status).toBe(200);
      expect(streamSpy).toHaveBeenCalled();
    } finally {
      streamSpy.mockRestore();
    }
  });

  it('passes conversation summary and detached values into Continuum execution context', async () => {
    const streamSpy = vi
      .spyOn(aiEngine, 'streamContinuumExecution')
      .mockImplementation(async function* (args) {
        expect(args.context?.conversationSummary).toBe(
          'Assistant removed several fields.'
        );
        expect(args.context?.detachedFields?.length).toBeGreaterThan(0);
        expect(args.context?.detachedFields?.[0]?.detachedKey).toBe(
          'detached:phone'
        );
        yield {
          kind: 'status',
          status: 'done',
          level: 'info',
        } as never;
        return {
          mode: 'noop',
          source: 'test',
          status: 'noop',
          level: 'warning',
          trace: [],
          requestedMode: 'view',
          reason: 'test',
        } as never;
      } as typeof aiEngine.streamContinuumExecution);

    try {
      const handler = createContinuumVercelAiSdkRouteHandler({
        adapter: createExecutionAdapter(),
        defaultAuthoringFormat: 'line-dsl',
      });

      const response = await handler(
        new Request('http://localhost/api/chat', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            continuum: {
              instruction: 'It does not have any of the previous stuff.',
            },
            conversationSummary: 'Assistant removed several fields.',
            detachedValues: {
              'detached:phone': {
                previousNodeType: 'field',
                reason: 'node-removed',
                viewVersion: '1',
                key: 'person.phone',
                value: { value: '555-0100' },
              },
            },
          }),
        })
      );

      expect(response.status).toBe(200);
      expect(streamSpy).toHaveBeenCalled();
    } finally {
      streamSpy.mockRestore();
    }
  });
});

describe('buildConversationTranscriptFromMessages', () => {
  it('returns undefined when there is no prior turn before the latest user message', () => {
    expect(
      buildConversationTranscriptFromMessages([
        { role: 'user', content: 'Only' },
      ])
    ).toBeUndefined();
  });

  it('includes prior user and assistant lines and excludes the latest user instruction', () => {
    const transcript = buildConversationTranscriptFromMessages([
      { role: 'user', content: 'Context about the live UI.' },
      { role: 'assistant', content: 'Acknowledged.' },
      { role: 'user', parts: [{ type: 'text', text: 'Latest ask' }] },
    ]);
    expect(transcript).toContain('Prior conversation');
    expect(transcript).toContain('User: Context about the live UI.');
    expect(transcript).toContain('Assistant: Acknowledged.');
    expect(transcript).not.toContain('Latest ask');
  });
});

describe('chat file attachments', () => {
  it('extractChatAttachmentsFromMessages parses image and PDF data URL parts from the latest user message', () => {
    const png = 'data:image/png;base64,iVBORw0KGgo=';
    const pdf = 'data:application/pdf;base64,JVBERi0x';
    const attachments = extractChatAttachmentsFromMessages([
      { role: 'assistant', parts: [{ type: 'text', text: 'hi' }] },
      {
        role: 'user',
        parts: [
          { type: 'text', text: 'see files' },
          { type: 'file', url: png, mediaType: 'image/png', filename: 'x.png' },
          {
            type: 'file',
            url: pdf,
            mediaType: 'application/pdf',
            filename: 'a.pdf',
          },
        ],
      },
    ]);
    expect(attachments).toHaveLength(2);
    expect(attachments[0]).toMatchObject({
      kind: 'image',
      mediaType: 'image/png',
      base64: 'iVBORw0KGgo=',
      filename: 'x.png',
    });
    expect(attachments[1]).toMatchObject({
      kind: 'file',
      mediaType: 'application/pdf',
      base64: 'JVBERi0x',
      filename: 'a.pdf',
    });
  });

  it('buildRouteContinuumExecutionContext forwards chatAttachments', () => {
    const pdf = 'data:application/pdf;base64,JVBERi0x';
    const context = buildRouteContinuumExecutionContext({
      messages: [
        {
          role: 'user',
          parts: [
            {
              type: 'file',
              url: pdf,
              mediaType: 'application/pdf',
              filename: 'a.pdf',
            },
          ],
        },
      ],
    } as never);
    expect(context.chatAttachments?.length).toBe(1);
    expect(context.chatAttachments?.[0].kind).toBe('file');
  });
});
