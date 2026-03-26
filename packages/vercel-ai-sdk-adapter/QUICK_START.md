# Vercel AI SDK Adapter Quick Start

This is the fastest way to make a Vercel AI SDK chat route drive a Continuum session.

## What You Already Need

This package assumes you already have:

- a Continuum session
- the `currentView` your app is rendering
- the canonical `currentData` for that view
- a server route where you can use an AI SDK `LanguageModel`

In most apps, the session and rendered snapshot come from `@continuum-dev/react`, `@continuum-dev/starter-kit`, or your own Continuum session wrapper.

## 1. Install

```bash
npm install @continuum-dev/vercel-ai-sdk-adapter ai react
```

Then install the model-provider package you want to use on the server, for example:

```bash
npm install @ai-sdk/openai
```

## 2. Add The Server Route

The easiest server story is the convenience route helper.

```ts
// app/api/chat/route.ts
import { openai } from '@ai-sdk/openai';
import {
  createContinuumVercelAiSdkRouteHandler,
  createVercelAiSdkContinuumExecutionAdapter,
} from '@continuum-dev/vercel-ai-sdk-adapter/server';

const adapter = createVercelAiSdkContinuumExecutionAdapter({
  model: openai('gpt-5'),
});

export const POST = createContinuumVercelAiSdkRouteHandler({
  adapter,
  defaultAuthoringFormat: 'line-dsl',
  defaultViewStreamMode: 'draft',
});
```

That helper already does the confusing server work for you:

- it accepts `POST` JSON only
- it reads the request body and builds `ContinuumExecutionContext`
- it resolves the instruction from `continuum.instruction` or the latest user message text
- it runs `@continuum-dev/ai-engine`
- it writes Continuum `data-*` parts into a Vercel AI SDK `UIMessage` stream
- it writes `data-continuum-execution-trace` and a final `data-continuum-status`

## 3. Send Continuum Context From The Client

Now keep your normal AI SDK transport, but include the current Continuum snapshot in the request body.

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
        // The current Continuum view and canonical data snapshot.
        currentView,
        currentData,
        // Optional bounded context for referential follow-up edits.
        conversationSummary,
        // Optional detached continuity hints from your session.
        detachedValues,
        continuum: {
          // Prompt authoring mode, not execution routing.
          mode: 'evolve-view',
          // Explicit execution routing when you do not want the default full view path.
          executionMode: 'patch',
          authoringFormat: 'line-dsl',
          emitViewPreviews: true,
        },
      }),
  }),
});
```

`useContinuumVercelAiSdkChat(...)` wraps `useChat(...)` and auto-applies Continuum parts into the session by default.

## 4. Understand What The Route Reads

The built-in route helper reads these fields from the POST body:

- `messages`
- `currentView`
- `currentData`
- `conversationSummary`
- `detachedValues`
- `detachedFields`
- `integrationCatalog`
- `registeredActions`
- `continuum`

The most important details are:

- `continuum.instruction` wins if you send it
- otherwise the helper uses the latest user message text
- if the latest user turn only contains file attachments, the helper uses `Use the attached file(s) to inform your response.`
- if there is still no usable instruction, the helper returns `400`

## 5. Know The Request Timeline

This is the order the adapter follows:

1. The client sends `messages` plus the Continuum snapshot and any optional Continuum settings.
2. The server extracts attachments from the latest user message only.
3. The server builds `ContinuumExecutionContext` from the request body.
4. `@continuum-dev/ai-engine` runs and yields status or mutation events.
5. The server writes those as `data-continuum-*` UI message parts.
6. The client hook applies transient preview and status parts immediately.
7. The client hook then applies the rest of the assistant message parts and finalizes any open turn streams when chat becomes `ready` or `error`.

That is the core lifecycle to keep in mind: request body in, Continuum parts out, session updated on the client.

## 6. When To Use The Lower-Level Server Helpers

Use the lower-level helpers when you already own a bigger AI SDK stream and just want Continuum to plug into it.

```ts
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
} from 'ai';
import { writeContinuumExecutionToUiMessageWriter } from '@continuum-dev/vercel-ai-sdk-adapter/server';

const stream = createUIMessageStream({
  execute: async ({ writer }) => {
    // Assume `assistantResult` is your existing AI SDK stream result.
    // First write your normal assistant stream.
    writer.merge(assistantResult.toUIMessageStream());

    // Then add Continuum execution parts to the same stream.
    await writeContinuumExecutionToUiMessageWriter({
      writer,
      adapter,
      instruction,
      context: {
        currentView,
        currentData,
      },
      authoringFormat: 'line-dsl',
    });
  },
});

return createUIMessageStreamResponse({ stream });
```

Reach for this path when you already have custom auth, tool calls, persistence, or a larger server orchestration story.

## 7. Common Gotchas

- `mode` and `executionMode` are different. `mode` is prompt authoring mode. `executionMode` is actual open-source routing.
- The built-in route helper is `POST` only.
- File attachments are read from the latest user message only.
- Attachment parsing only supports `data:` URLs with a base64 payload.
- `data-continuum-execution-trace` is for observability only and is ignored by the apply helpers.
- `continuumVercelAiSdkDataPartSchemas` does not include the execution-trace part.
- If your session does not expose stream APIs, the adapter still applies view and state changes through fallback session methods.
