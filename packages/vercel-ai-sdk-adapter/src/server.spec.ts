import { describe, expect, it } from 'vitest';
import type { ContinuumExecutionAdapter } from '@continuum-dev/ai-engine';
import {
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
    expect(body).toContain('loan_form');
  });
});
