# @continuum-dev/vercel-ai-sdk

Bridge Vercel AI SDK message streams into Continuum sessions.

This package is intentionally Continuum-first.

It does not try to become a provider-routing layer. Instead it gives you:

- typed Vercel AI SDK UI-message data parts for Continuum view/state updates
- helpers to apply streamed message parts into a Continuum session
- a React hook that keeps `useChat` and a Continuum session in sync

## Install

```bash
npm install @continuum-dev/vercel-ai-sdk ai @ai-sdk/react react
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
- `data-continuum-state`
- `data-continuum-reset`
- `data-continuum-status`

The first three map directly onto Continuum session operations.

## License

MIT
