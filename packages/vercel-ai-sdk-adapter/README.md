# @continuum-dev/vercel-ai-sdk-adapter

Continuum adapter for the Vercel AI SDK.

This package is for teams that already use the Vercel AI SDK and want Continuum to own the runtime side of evolving UI without replacing the SDK's transport, tools, or route architecture.

It gives you:

- typed Continuum `data-*` parts for AI SDK UI messages
- helpers to apply those parts into a Continuum session
- a React hook that keeps `useChat` and a Continuum session in sync
- request-body helpers for adding `currentView` and `currentData` to AI SDK requests
- composable server helpers that write Continuum parts into an existing AI SDK UI stream

## Install

```bash
npm install @continuum-dev/vercel-ai-sdk-adapter react
```

Most apps pair this package with:

- `@continuum-dev/react` or `@continuum-dev/starter-kit` for rendering and session state
- `@continuum-dev/ai-engine` for planning, parsing, normalization, and apply behavior
- `@continuum-dev/starter-kit-ai` only when you want thin starter-oriented chat wrappers

## Client usage

Keep your normal AI SDK transport and add Continuum request data to it:

```tsx
import { DefaultChatTransport } from 'ai';
import {
  buildContinuumVercelAiSdkRequestBody,
  useContinuumVercelAiSdkChat,
  type ContinuumVercelAiSdkMessage,
} from '@continuum-dev/vercel-ai-sdk-adapter';

const chat = useContinuumVercelAiSdkChat<ContinuumVercelAiSdkMessage>({
  session,
  transport: new DefaultChatTransport({
    api: '/api/chat',
    body: () =>
      buildContinuumVercelAiSdkRequestBody({
        currentView,
        currentData,
      }),
  }),
});
```

If you want AI SDK runtime schemas for your message metadata and Continuum `data-*` parts:

```ts
import {
  continuumVercelAiSdkDataPartSchemas,
  continuumVercelAiSdkMessageMetadataSchema,
} from '@continuum-dev/vercel-ai-sdk-adapter';
```

## Server usage

The primary server story is composable. Keep your own route, auth, tools, and persistence, then write Continuum parts into the same AI SDK UI stream:

```ts
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

export async function POST(request: Request) {
  const body = await request.json();
  const { messages, currentView, currentData } = body;
  const instruction =
    body.continuum?.instruction ??
    messages[messages.length - 1]?.parts?.find(
      (part: any) => part.type === 'text'
    )?.text;

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
        context: { currentView, currentData },
        authoringFormat: 'line-dsl',
      });
    },
  });

  return createUIMessageStreamResponse({ stream });
}
```

For demos or very small apps, the convenience route helper is still available:

```ts
import { openai } from '@ai-sdk/openai';
import {
  createContinuumVercelAiSdkRouteHandler,
  createVercelAiSdkContinuumExecutionAdapter,
} from '@continuum-dev/vercel-ai-sdk-adapter/server';

export const POST = createContinuumVercelAiSdkRouteHandler({
  adapter: createVercelAiSdkContinuumExecutionAdapter({
    model: openai('gpt-5'),
  }),
});
```

## Built-in Continuum data parts

- `data-continuum-view`
- `data-continuum-patch`
- `data-continuum-insert-node`
- `data-continuum-replace-node`
- `data-continuum-remove-node`
- `data-continuum-append-content`
- `data-continuum-state`
- `data-continuum-reset`
- `data-continuum-status`
- `data-continuum-node-status`

These normalize into Continuum stream/session behavior, including draft previews, proposal-safe state updates, and commit/abort handling.

## Boundaries

- `@continuum-dev/ai-engine` owns planning, repair, and state/patch/view execution
- `@continuum-dev/vercel-ai-sdk-adapter` owns AI SDK request shaping, message typing, writer helpers, and client-side Continuum application
- this package does not own auth, storage, tool execution, or your main assistant text stream

## Related docs

- [AI Integration Guide](../../docs/AI_INTEGRATION.md)
- [Integration Guide](../../docs/INTEGRATION_GUIDE.md)

## License

MIT
