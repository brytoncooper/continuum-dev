import { createUIMessageStreamResponse } from 'ai';
import {
  createContinuumUiMessageStream,
  createVercelAiSdkContinuumExecutionAdapter,
} from '@continuum-dev/vercel-ai-sdk-adapter/server';
import {
  VERCEL_AI_SDK_LIVE_PATH,
  extractLatestUserInstruction,
  isVercelAiSdkLivePath,
  methodNotAllowed,
  resolveLiveProvider,
} from './vercel-ai-sdk-shared.mjs';

export { isVercelAiSdkLivePath };
export { VERCEL_AI_SDK_LIVE_PATH };

export async function handleVercelAiSdkLiveRequest(request, env = {}) {
  if (request.method !== 'POST') {
    return methodNotAllowed('POST');
  }

  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return new Response('Invalid JSON request body.', {
        status: 400,
      });
    }

    const instruction =
      body.continuum?.instruction?.trim() ||
      extractLatestUserInstruction(body.messages);
    const continuumAddons = Array.isArray(body.continuum?.addons)
      ? Array.from(new Set([...body.continuum.addons, 'strict-continuity']))
      : ['strict-continuity'];

    if (!instruction) {
      return new Response(
        'Add an instruction before sending a live Vercel AI SDK request.',
        {
          status: 400,
        }
      );
    }

    const providerId =
      typeof body.providerId === 'string' ? body.providerId : 'openai';
    const requestedModel =
      typeof body.model === 'string' ? body.model : undefined;
    const resolvedProvider = resolveLiveProvider({
      providerId,
      model: requestedModel,
      headers: request.headers,
      env,
    });

    const stream = createContinuumUiMessageStream({
      adapter: createVercelAiSdkContinuumExecutionAdapter({
        label: `${resolvedProvider.provider.label} (${resolvedProvider.modelId})`,
        model: resolvedProvider.languageModel,
      }),
      instruction,
      context: {
        currentView: body.currentView ?? undefined,
        currentData: body.currentData ?? undefined,
      },
      mode: body.continuum?.mode,
      addons: continuumAddons,
      outputContract: body.continuum?.outputContract,
      authoringFormat: body.continuum?.authoringFormat ?? 'line-dsl',
      autoApplyView: body.continuum?.autoApplyView,
      viewStreamMode: 'foreground',
      onResult(result) {
        if (result.level === 'warning') {
          console.warn('[vercel-ai-sdk-live-route] Continuum returned without applying changes.', {
            mode: result.mode,
            status: result.status,
            reason: 'reason' in result ? result.reason : undefined,
          });
        }
      },
    });

    return createUIMessageStreamResponse({
      stream,
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : 'Unable to resolve the requested provider.';

    return new Response(message, {
      status: 400,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
      },
    });
  }
}
