import { createUIMessageStreamResponse } from 'ai';
import * as aiEngine from '@continuum-dev/ai-engine';
import type { ContinuumExecutionAdapter } from '@continuum-dev/ai-engine';
import { describe, expect, it, vi } from 'vitest';
import {
  createContinuumUiMessageStream,
  createContinuumVercelAiSdkRouteHandler,
  writeContinuumExecutionToUiMessageWriter,
} from './server.js';

const generatedViewText = `view viewId="loan_form" version="1"
group id="loan_root" label="Loan form"
  field id="email" key="email" label="Email" dataType="string"`;

function createExecutionAdapter(): ContinuumExecutionAdapter {
  return {
    label: 'Fake AI SDK',
    async generate(request) {
      expect(request.mode).toBe('view');
      return {
        text: generatedViewText,
        raw: generatedViewText,
      };
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
    expect(
      chunks.some((chunk) => chunk.type === 'data-continuum-patch')
    ).toBe(true);
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
            status: 'Applied localized Continuum patch operations from Mock AI.',
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

      expect(body).toContain('Patch update could not be applied; no changes were made.');
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

  it('passes conversation summary and detached values into Continuum execution context', async () => {
    const streamSpy = vi
      .spyOn(aiEngine, 'streamContinuumExecution')
      .mockImplementation((async function* (args) {
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
      }) as typeof aiEngine.streamContinuumExecution);

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
