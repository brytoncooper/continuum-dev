# AI Integration Guide

If you want AI plus Continuum, start by choosing a lane.

Most users should not begin from `ai-engine` alone. They usually want one of these two public paths:

| Lane | Use it when | Start with |
| --- | --- | --- |
| Direct provider lane | you want the fastest AI-connected Continuum session in React | `@continuum-dev/starter-kit-ai` and [Quick Start](./QUICK_START.md) |
| Vercel AI SDK lane | you already have, or want, a server-backed Vercel AI SDK route | `@continuum-dev/vercel-ai-sdk-adapter` |

## The Core Rule

AI should not overwrite raw Continuum session state directly.

The normal public flow is:

1. build AI context from the current Continuum session
2. generate a Continuum result
3. check or normalize that result
4. apply it back through the local session
5. let the renderer re-render from the new snapshot

That is how Continuum protects continuity instead of treating AI output like blind state replacement.

## Lane 1: Fastest Path To A Session With AI

Use this lane when you want the smallest setup and you are comfortable with a direct provider-backed browser path.

Packages:

- `@continuum-dev/starter-kit-ai`
- `react`
- `react-dom`

Install:

```bash
npm install @continuum-dev/starter-kit-ai react react-dom
```

Minimal app:

```tsx
import { useEffect } from 'react';
import {
  ContinuumProvider,
  ContinuumRenderer,
  StarterKitProviderChatBox,
  createAiConnectProviders,
  starterKitComponentMap,
  useContinuumSession,
  useContinuumSnapshot,
  type ViewDefinition,
} from '@continuum-dev/starter-kit-ai';

const providers = createAiConnectProviders({
  include: ['openai'],
  openai: {
    apiKey: import.meta.env.VITE_OPENAI_API_KEY,
    model: import.meta.env.VITE_OPENAI_MODEL ?? 'gpt-4o-mini',
  },
});

const initialView: ViewDefinition = {
  viewId: 'profile',
  version: '1',
  nodes: [
    {
      id: 'profile',
      type: 'group',
      label: 'Profile',
      children: [
        {
          id: 'email',
          type: 'field',
          dataType: 'string',
          label: 'Email',
        },
      ],
    },
  ],
};

function Screen() {
  const session = useContinuumSession();
  const snapshot = useContinuumSnapshot();

  useEffect(() => {
    if (!session.getSnapshot()) {
      session.pushView(initialView);
    }
  }, [session]);

  if (!snapshot?.view) {
    return null;
  }

  return (
    <>
      <StarterKitProviderChatBox
        providers={providers}
        title="Ask Continuum AI"
      />
      <ContinuumRenderer view={snapshot.view} />
    </>
  );
}

export function App() {
  return (
    <ContinuumProvider
      components={starterKitComponentMap}
      persist="localStorage"
    >
      <Screen />
    </ContinuumProvider>
  );
}
```

What this lane does for you:

- `StarterKitProviderChatBox` reads the active Continuum session from React context
- `useProviderChatController(...)` builds execution context from that live session
- `@continuum-dev/ai-engine` runs the instruction
- successful results apply back into the same session by default

Use this lane for the fastest start, demos, and controlled environments. If you do not want provider credentials in the browser, move to the Vercel AI SDK lane.

## Lane 2: Keep Your Vercel AI SDK App

Use this lane when:

- you already have a Vercel AI SDK chat route
- you want a server-backed transport boundary
- you want file attachment support in the chat flow
- you want Continuum updates streamed into the same AI SDK message flow

### 1. Install

```bash
npm install @continuum-dev/vercel-ai-sdk-adapter ai react
```

Then add your model provider package on the server, for example:

```bash
npm install @ai-sdk/openai
```

### 2. Send The Current Continuum Snapshot From The Client

```tsx
import { DefaultChatTransport } from 'ai';
import { useContinuumSession } from '@continuum-dev/react';
import {
  buildContinuumVercelAiSdkRequestBody,
  useContinuumVercelAiSdkChat,
} from '@continuum-dev/vercel-ai-sdk-adapter';

export function ContinuumChat() {
  const session = useContinuumSession();

  const chat = useContinuumVercelAiSdkChat({
    session,
    transport: new DefaultChatTransport({
      api: '/api/chat',
      body: () => {
        const snapshot = session.getSnapshot();
        return buildContinuumVercelAiSdkRequestBody({
          currentView: snapshot?.view ?? null,
          currentData: snapshot?.data.values ?? null,
          continuum: {
            mode: 'evolve-view',
            authoringFormat: 'line-dsl',
          },
        });
      },
    }),
  });

  return (
    <button
      onClick={() =>
        chat.sendMessage({ text: 'Add a phone field under Email.' })
      }
    >
      Send
    </button>
  );
}
```

Important details:

- always send the `currentView` your UI is rendering now
- always send the canonical `currentData` for that view
- `useContinuumVercelAiSdkChat(...)` auto-applies Continuum parts into the session by default

### 3. Add The Server Route

```ts
import { openai } from '@ai-sdk/openai';
import {
  createContinuumVercelAiSdkRouteHandler,
  createVercelAiSdkContinuumExecutionAdapter,
} from '@continuum-dev/vercel-ai-sdk-adapter/server';

export const POST = createContinuumVercelAiSdkRouteHandler({
  adapter: createVercelAiSdkContinuumExecutionAdapter({
    model: openai(process.env.OPENAI_MODEL ?? 'gpt-4o-mini'),
  }),
  defaultAuthoringFormat: 'line-dsl',
});
```

That helper already does the server wiring that is easy to get wrong:

- reads the POST body
- builds `ContinuumExecutionContext`
- resolves the instruction from `continuum.instruction` or the latest user message text
- falls back to `Use the attached file(s) to inform your response.` when the latest user message only has attachments
- runs `@continuum-dev/ai-engine`
- writes `data-continuum-*` parts into the AI SDK stream

### 4. Know The Vercel Lane Order

1. the client sends chat `messages` plus Continuum snapshot fields
2. the server builds Continuum execution context from that body
3. `@continuum-dev/ai-engine` runs and emits Continuum result events
4. the server writes those events as `data-continuum-*` parts
5. `useContinuumVercelAiSdkChat(...)` applies those parts into the local session
6. your renderer re-renders from the updated session snapshot

That is the core timeline to keep in mind: request body in, Continuum parts out, local session updated.

## What Actually Gets Applied Into The Session

This is the important safety model behind both lanes.

### Structural AI changes

- full view, transform, and patch-style results are evaluated before acceptance
- successful structural results are then applied through the Continuum session
- when possible, the session streaming foundation is used first
- otherwise the session falls back to normal local apply methods such as `applyView(...)`

### AI value changes

- value-only results are not treated as raw session overwrites
- the apply helpers use the session streaming foundation when available
- otherwise they fall back to proposal-safe session behavior such as `proposeValue(...)`

So the normal public path is not "AI directly overwrites the session." It is "AI produces a result that the Continuum session then applies."

## If You Want A Custom UI Instead Of Shipped Chat Boxes

Start from the headless path:

- `@continuum-dev/react`
- `@continuum-dev/session`
- `@continuum-dev/ai-engine`
- `@continuum-dev/ai-connect` or `@continuum-dev/vercel-ai-sdk-adapter`

Example:

```ts
import {
  applyContinuumExecutionFinalResult,
  buildContinuumExecutionContext,
  createContinuumSessionAdapter,
  runContinuumExecution,
} from '@continuum-dev/ai-engine';
import { createAiConnectContinuumExecutionAdapter } from '@continuum-dev/ai-connect';

const continuumSession = createContinuumSessionAdapter(session);

const result = await runContinuumExecution({
  adapter: createAiConnectContinuumExecutionAdapter(provider),
  instruction: 'Refine this form for mobile.',
  context: buildContinuumExecutionContext(continuumSession),
  mode: 'evolve-view',
  authoringFormat: 'line-dsl',
});

applyContinuumExecutionFinalResult(continuumSession, result);
```

Use this when you want the execution behavior without the shipped starter chat UI.

## Common Gotchas

- `mode` and `executionMode` are different.
  `mode` is prompt authoring mode. `executionMode` is explicit execution routing.
- `StarterKitVercelAiSdkChatBox` does not take `session` in `chatOptions`.
  It reads the active Continuum session from provider context.
- The direct provider lane is the fastest path, not the safest server boundary.
- The Vercel lane is the right path when you want attachment files in the shipped chat flow.
- If you are using the Vercel lane, send the current view and canonical data every time.

## Related Docs

- [Quick Start](./QUICK_START.md)
- [Integration Guide](./INTEGRATION_GUIDE.md)
- [`@continuum-dev/starter-kit-ai`](../packages/starter-kit-ai/README.md)
- [`@continuum-dev/vercel-ai-sdk-adapter`](../packages/vercel-ai-sdk-adapter/README.md)
