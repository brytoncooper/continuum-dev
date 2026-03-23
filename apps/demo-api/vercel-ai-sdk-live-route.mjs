import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
} from 'ai';
import {
  buildRouteContinuumExecutionContext,
  createContinuumUiMessageStream,
  createVercelAiSdkContinuumExecutionAdapter,
  serializeContinuumExecutionForObservability,
} from '@continuum-dev/vercel-ai-sdk-adapter/server';
import { writeVercelAiSdkExecutionLogFile } from './append-vercel-ai-sdk-execution-log.mjs';
import {
  VERCEL_AI_SDK_LIVE_PATH,
  extractLatestUserInstruction,
  isVercelAiSdkLivePath,
  methodNotAllowed,
  resolveLiveProvider,
} from './vercel-ai-sdk-shared.mjs';

const FALLBACK_INSTRUCTION_FOR_ATTACHMENTS =
  'Use the attached file(s) to inform your response.';

const DEBUG_ECHO_SYSTEM_PROMPT = [
  'You are in debug mode for a multimodal chat integration.',
  'Reply in Markdown. Summarize the latest user turn: quoted user text and each attachment.',
  'For images, describe what you see. For PDFs, summarize readable content or layout.',
  'If an attachment could not be read, say so. Be concise and factual.',
].join(' ');

function parseDataUrlBase64Payload(dataUrl) {
  const match = /^data:([^;,]+);base64,(.+)$/i.exec(dataUrl);
  if (!match) {
    return null;
  }
  return match[2];
}

function normalizeModelMessagesFileDataUrlsToBase64(messages) {
  return messages.map((message) => {
    const content = message.content;
    if (!Array.isArray(content)) {
      return message;
    }
    let changed = false;
    const nextContent = content.map((part) => {
      if (!part || typeof part !== 'object' || part.type !== 'file') {
        return part;
      }
      if (typeof part.data !== 'string') {
        return part;
      }
      const base64 = parseDataUrlBase64Payload(part.data);
      if (base64 === null) {
        return part;
      }
      changed = true;
      return { ...part, data: base64 };
    });
    return changed ? { ...message, content: nextContent } : message;
  });
}

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

    if (body.continuum?.debugEcho === true) {
      if (!Array.isArray(body.messages) || body.messages.length === 0) {
        return new Response('Debug mode requires a non-empty messages array.', {
          status: 400,
        });
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

      const uiMessages = body.messages.map((message) => {
        if (message && typeof message === 'object' && 'id' in message) {
          const { id: _omit, ...rest } = message;
          return rest;
        }
        return message;
      });

      const converted = await convertToModelMessages(uiMessages);
      const modelMessages =
        normalizeModelMessagesFileDataUrlsToBase64(converted);
      const result = streamText({
        model: resolvedProvider.languageModel,
        system: DEBUG_ECHO_SYSTEM_PROMPT,
        messages: modelMessages,
        temperature: 0.2,
      });

      return result.toUIMessageStreamResponse();
    }

    const context = buildRouteContinuumExecutionContext(body);
    const chatAttachments = context.chatAttachments ?? [];
    let instruction =
      body.continuum?.instruction?.trim() ||
      extractLatestUserInstruction(body.messages);
    if (!instruction.trim() && chatAttachments.length > 0) {
      instruction = FALLBACK_INSTRUCTION_FOR_ATTACHMENTS;
    }
    const continuumAddons = Array.isArray(body.continuum?.addons)
      ? Array.from(new Set([...body.continuum.addons, 'strict-continuity']))
      : ['strict-continuity'];

    if (!instruction.trim()) {
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
      context,
      mode: body.continuum?.mode,
      addons: continuumAddons,
      outputContract: body.continuum?.outputContract,
      authoringFormat: body.continuum?.authoringFormat ?? 'line-dsl',
      autoApplyView: body.continuum?.autoApplyView,
      emitViewPreviews: body.continuum?.emitViewPreviews,
      viewPreviewThrottleMs: body.continuum?.viewPreviewThrottleMs,
      viewStreamMode: 'foreground',
      async onResult(result) {
        if (result.level === 'warning') {
          console.warn(
            '[vercel-ai-sdk-live-route] Continuum returned without applying changes.',
            {
              mode: result.mode,
              status: result.status,
              reason: 'reason' in result ? result.reason : undefined,
            }
          );
        }
        try {
          const filePath = await writeVercelAiSdkExecutionLogFile({
            recordedAt: new Date().toISOString(),
            provider: providerId,
            model: resolvedProvider.modelId,
            providerLabel: `${resolvedProvider.provider.label} (${resolvedProvider.modelId})`,
            ...serializeContinuumExecutionForObservability(instruction, result),
          });
          console.log(
            `[vercel-ai-sdk-live-route] Wrote execution log: ${filePath}`
          );
        } catch (error) {
          console.error(
            '[vercel-ai-sdk-live-route] Failed to write execution log file',
            error
          );
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
