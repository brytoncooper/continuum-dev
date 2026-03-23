import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
} from 'ai';
import { openai } from '@ai-sdk/openai';
import {
  createVercelAiSdkContinuumExecutionAdapter,
  writeContinuumExecutionToUiMessageWriter,
} from '@continuum-dev/vercel-ai-sdk-adapter/server';

export const headlessAiReferenceServerPackages = [
  '@ai-sdk/openai',
  '@continuum-dev/ai-engine',
  '@continuum-dev/vercel-ai-sdk-adapter',
  'ai',
];

function getInstructionFromMessages(messages) {
  const latestMessage = messages[messages.length - 1];
  if (!latestMessage || !Array.isArray(latestMessage.parts)) {
    return '';
  }

  const textPart = latestMessage.parts.find(
    (part) => part && typeof part === 'object' && part.type === 'text'
  );

  return textPart && typeof textPart.text === 'string' ? textPart.text : '';
}

export async function handleHeadlessAiReferenceRequest(request) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed.', {
      status: 405,
    });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return new Response('Invalid JSON request body.', {
      status: 400,
    });
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  const instruction =
    typeof body.continuum?.instruction === 'string'
      ? body.continuum.instruction.trim()
      : getInstructionFromMessages(messages).trim();

  if (!instruction) {
    return new Response('Add an instruction before running the headless AI reference route.', {
      status: 400,
    });
  }

  const model = openai('gpt-5');
  const result = streamText({
    model,
    messages: convertToModelMessages(messages),
  });

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      writer.merge(result.toUIMessageStream());
      await writeContinuumExecutionToUiMessageWriter({
        writer,
        adapter: createVercelAiSdkContinuumExecutionAdapter({ model }),
        instruction,
        context: {
          currentView: body.currentView ?? null,
          currentData: body.currentData ?? null,
        },
        authoringFormat: 'line-dsl',
      });
    },
  });

  return createUIMessageStreamResponse({ stream });
}

export const POST = handleHeadlessAiReferenceRequest;
