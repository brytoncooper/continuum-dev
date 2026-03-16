# @continuum-dev/vercel-ai-sdk

Bridge Vercel AI SDK message streams into Continuum sessions.

See the shared streaming guide in [@continuum-dev/session](../session/STREAMING.md) for the snapshot model, conflict rules, and richer stream-part vocabulary.

Upgrade references:

- [Root upgrade guide](../../docs/UPGRADING_FROM_0.3.x_TO_NEXT.md)
- [API delta](../../docs/API_DELTA_0.3.x_TO_NEXT.md)

This package is intentionally Continuum-first.

It does not try to become a provider-routing layer. Instead it gives you:

- typed Vercel AI SDK UI-message data parts for Continuum view/state updates
- helpers to apply streamed message parts into a Continuum session
- a React hook that keeps `useChat` and a Continuum session in sync
- stream-aware normalization into `session.beginStream() / applyStreamPart() / commitStream()`

## Install

```bash
npm install @continuum-dev/vercel-ai-sdk react
```

If you want the curated headless Continuum lane under one package name instead, install:

```bash
npm install @continuum-dev/ai-core react
```

## What this package is for

Use this package when:

- Vercel AI SDK is your transport and streaming layer
- Continuum session/runtime is your source of truth
- model output should become `pushView`, `updateState`, or `reset` operations

## Quick example

```tsx
import { useMemo } from 'react';
import { DefaultChatTransport } from 'ai';
import { createSession } from '@continuum-dev/session';
import {
  ContinuumProvider,
  ContinuumRenderer,
  starterKitComponentMap,
  useContinuumSnapshot,
} from '@continuum-dev/starter-kit';
import {
  createContinuumVercelAiSdkSessionAdapter,
  useContinuumVercelAiSdkChat,
  type ContinuumVercelAiSdkMessage,
} from '@continuum-dev/vercel-ai-sdk';

function ChatBridge() {
  const session = useMemo(() => createSession(), []);
  const adapter = useMemo(
    () => createContinuumVercelAiSdkSessionAdapter(session),
    [session]
  );

  const chat = useContinuumVercelAiSdkChat<ContinuumVercelAiSdkMessage>({
    session: adapter,
    transport: new DefaultChatTransport({
      api: '/api/chat',
    }),
  });

  return (
    <button
      type="button"
      onClick={() => {
        void chat.sendMessage({ text: 'Build a loan intake form' });
      }}
    >
      Ask AI
    </button>
  );
}

function Screen() {
  const snapshot = useContinuumSnapshot();
  if (!snapshot?.view) {
    return null;
  }

  return <ContinuumRenderer view={snapshot.view} />;
}

export function App() {
  return (
    <ContinuumProvider components={starterKitComponentMap}>
      <ChatBridge />
      <Screen />
    </ContinuumProvider>
  );
}
```

## Built-in data parts

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

The structured parts normalize into the session streaming foundation:

- `view` and `patch` become `SessionStreamPart` view/patch updates
- `state` respects Continuum proposal semantics, including dirty/sticky protection
- `status` updates stream metadata without forcing a commit

When you mark a chunk as `transient: true`, the adapter keeps it in the render snapshot until the stream is committed. That means UI can build incrementally without mutating the durable committed snapshot too early.

For streamed full-view regeneration, prefer `streamMode: 'draft'`. Draft-mode parts build a non-live preview stream and only mutate the committed session when the final non-transient draft part is committed.

```ts
import {
  applyContinuumVercelAiSdkDataPart,
  createContinuumVercelAiSdkPatchDataChunk,
} from '@continuum-dev/vercel-ai-sdk';

const application = applyContinuumVercelAiSdkDataPart(
  createContinuumVercelAiSdkPatchDataChunk(
    {
      patch: {
        viewId: 'loan-intake',
        version: '2.0',
        operations: [
          {
            op: 'insert-node',
            parentId: 'loan_group',
            node: {
              id: 'borrower_email',
              type: 'field',
              dataType: 'string',
            },
          },
        ],
      },
    },
    { transient: true }
  ),
  adapter
);
```

Draft preview example:

```ts
import { createContinuumVercelAiSdkViewDataChunk } from '@continuum-dev/vercel-ai-sdk';

createContinuumVercelAiSdkViewDataChunk(
  {
    view: nextView,
  },
  {
    transient: true,
    streamMode: 'draft',
  }
);
```

Deterministic conflict behavior:

- open streams are scoped by `targetViewId`
- a newer superseding stream wins explicitly
- dirty or sticky user-owned values become proposals instead of being overwritten
- transient render-only user edits stay in the stream draft until commit, or become detached values on abort

## License

MIT
