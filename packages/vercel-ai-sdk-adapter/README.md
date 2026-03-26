# @continuum-dev/vercel-ai-sdk-adapter

`@continuum-dev/vercel-ai-sdk-adapter` lets a Continuum app use the Vercel AI SDK's request and `UIMessage` stream shape without giving up Continuum session continuity.

## Why This Exists

If you already use the Vercel AI SDK for chat transport and streamed assistant messages, but the assistant also needs to edit a Continuum view or write Continuum state, you need a bridge between those two systems. This package is that bridge. It lets you keep the AI SDK route and message model you already use while Continuum owns view evolution, patch application, and proposal-safe state writes.

## How It Works

1. The client sends normal AI SDK `messages` and adds Continuum context like `currentView`, `currentData`, detached-value hints, and optional Continuum request settings.
2. The server turns that POST body into `ContinuumExecutionContext`, runs `@continuum-dev/ai-engine`, and writes `data-continuum-*` parts into the same AI SDK `UIMessage` stream.
3. The client hook or lower-level apply helpers read those parts and apply them into a Continuum session.
4. If the session supports Continuum streams, those parts go through the streaming foundation. Otherwise the adapter falls back to direct `applyView` or `pushView`, `proposeValue`, or `updateState` behavior.

## What It Is

This package is a thin adapter layer around:

- client request builders and React chat helpers
- typed Continuum `data-*` UI message parts
- server helpers that stream Continuum execution into AI SDK routes

It is not a planner, a model-provider catalog, a chat UI kit, or your app's auth, storage, and tool layer.

## Install

```bash
npm install @continuum-dev/vercel-ai-sdk-adapter ai react
```

You also need the model-provider package you want to use on the server, for example `@ai-sdk/openai`.

## Easiest Path

The simplest supported path is:

1. keep a Continuum session in your app,
2. send the current Continuum snapshot with each chat request,
3. use the convenience route helper on the server,
4. let `useContinuumVercelAiSdkChat(...)` auto-apply streamed parts back into the session.

### 1. Server route

```ts
import { openai } from '@ai-sdk/openai';
import {
  createContinuumVercelAiSdkRouteHandler,
  createVercelAiSdkContinuumExecutionAdapter,
} from '@continuum-dev/vercel-ai-sdk-adapter/server';

const adapter = createVercelAiSdkContinuumExecutionAdapter({
  model: openai('gpt-5'),
});

// This helper owns POST parsing, context building, ai-engine execution,
// and Continuum data-part streaming.
export const POST = createContinuumVercelAiSdkRouteHandler({
  adapter,
  defaultAuthoringFormat: 'line-dsl',
});
```

### 2. Client hook

Assume `session`, `currentView`, and `currentData` come from the Continuum app state you are already rendering.

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
        // Send the same Continuum snapshot your UI is currently using.
        currentView,
        currentData,
        continuum: {
          // `mode` is prompt authoring mode, not execution routing.
          mode: 'evolve-view',
          authoringFormat: 'line-dsl',
        },
      }),
  }),
});
```

That path keeps your normal AI SDK chat transport, but the assistant can now stream Continuum view and state changes back into the live session.

Need the full server walkthrough? See [QUICK_START.md](./QUICK_START.md).

## Normal Request Order

1. The client sends `messages` plus Continuum context.
2. The route helper resolves the instruction from `continuum.instruction`, or from the latest user message text.
3. If there is no text instruction but the latest user message has file attachments, the helper falls back to `Use the attached file(s) to inform your response.`.
4. If there is still no usable instruction, the helper returns `400`.
5. The helper builds `ContinuumExecutionContext` from `currentView`, `currentData`, `conversationSummary`, `detachedFields` or `detachedValues`, `integrationCatalog`, `registeredActions`, and attachments from the latest user message.
6. The server writes status and mutation parts during execution, then `data-continuum-execution-trace`, then a final `data-continuum-status`.
7. The hook applies transient preview and status parts immediately, then scans assistant messages for the rest of the Continuum parts, and finalizes any open turn streams when chat status becomes `ready` or `error`.

## Other Options

### Compose Continuum into an existing AI SDK route

Use `writeContinuumExecutionToUiMessageWriter(...)` when you already own the surrounding UI message stream and just want Continuum parts merged into it.

```ts
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
} from 'ai';
import { writeContinuumExecutionToUiMessageWriter } from '@continuum-dev/vercel-ai-sdk-adapter/server';

const stream = createUIMessageStream({
  execute: async ({ writer }) => {
    // Assume `assistantResult` is your existing AI SDK stream result.
    // Merge your normal assistant text or tool stream first.
    writer.merge(assistantResult.toUIMessageStream());

    // Then write Continuum mutations into the same UI message stream.
    await writeContinuumExecutionToUiMessageWriter({
      writer,
      adapter,
      instruction,
      context,
      authoringFormat: 'line-dsl',
    });
  },
});

return createUIMessageStreamResponse({ stream });
```

### Build the stream yourself

- `createContinuumUiMessageStream(...)` builds a UI message stream that only writes Continuum execution parts.
- `resolveAdapter` on `createContinuumVercelAiSdkRouteHandler(...)` lets the route choose a model per request.

### Apply saved assistant messages later

- `applyContinuumVercelAiSdkDataPart(...)`
- `applyContinuumVercelAiSdkMessage(...)`
- `applyContinuumVercelAiSdkMessages(...)`

Use these when Continuum parts were persisted with chat messages and need to be replayed into a session later.

### Work with typed parts directly

- data chunk factories like `createContinuumVercelAiSdkViewDataChunk(...)`
- `createContinuumVercelAiSdkSessionAdapter(...)`
- `continuumVercelAiSdkMessageMetadataSchema`
- `continuumVercelAiSdkDataPartSchemas`

## Dictionary Contract

### Request body fields

`buildContinuumVercelAiSdkRequestBody(...)` can add these top-level fields:

- `currentView`
- `currentData`
- `conversationSummary`
- `detachedValues`
- `detachedFields`
- `integrationCatalog`
- `registeredActions`
- `continuum`

### `continuum` request options

- `instruction?`
- `mode?`
- `executionMode?`
- `executionPlan?`
- `addons?`
- `outputContract?`
- `authoringFormat?`
- `autoApplyView?`
- `emitViewPreviews?`
- `viewPreviewThrottleMs?`
- `debugEcho?`

The exported request type includes `debugEcho`, but the built-in server helpers in this package do not currently read it.

### Literal values

- `executionMode`: `'state' | 'patch' | 'transform' | 'view'`
- `authoringFormat`: `'line-dsl' | 'yaml' | 'view-json'`
- `status.level`: `'info' | 'success' | 'warning' | 'error'`
- `streamMode`: `'foreground' | 'draft'`

### Streamed Continuum part types

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
- `data-continuum-execution-trace`

### Interpreted application kinds

- `view`
- `patch`
- `insert-node`
- `replace-node`
- `remove-node`
- `append-content`
- `state`
- `reset`
- `status`
- `node-status`
- `ignored`

### Route-helper defaults and constraints

- `createContinuumVercelAiSdkRouteHandler(...)` supports `POST` only.
- `defaultAuthoringFormat` falls back to `'line-dsl'`.
- `viewStreamMode` in `writeContinuumExecutionToUiMessageWriter(...)` falls back to `'draft'`.
- `data-continuum-execution-trace` is observational only. The apply helpers treat it as `ignored`.
- `continuumVercelAiSdkDataPartSchemas` covers the mutating and status parts, but not `data-continuum-execution-trace`.

## Related Docs

- [Quick Start](./QUICK_START.md)
- [AI Integration Guide](../../docs/AI_INTEGRATION.md)
- [Integration Guide](../../docs/INTEGRATION_GUIDE.md)

## License

MIT
