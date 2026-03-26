# Quick Start

Get a Continuum session on screen and wire it to AI with the fewest moving parts.

This guide is the fastest shipped path:

- React app
- `@continuum-dev/starter-kit-ai`
- one Continuum session
- one direct provider-backed AI chat box

If you already have a server boundary or an existing Vercel AI SDK app, skip to [AI Integration Guide](./AI_INTEGRATION.md).

## What You Will Build

By the end of this guide you will have:

- a React app wrapped in `ContinuumProvider`
- a mounted `ViewDefinition`
- local session persistence across refresh
- an AI instruction box that updates that same Continuum session

## 1. Install The Fastest Path

Use any React 18 app scaffold you like, then install:

```bash
npm install @continuum-dev/starter-kit-ai react react-dom
```

For the example below, add:

- `VITE_OPENAI_API_KEY`
- optional `VITE_OPENAI_MODEL`

This guide uses the direct provider lane because it is the smallest honest setup. If you do not want provider credentials in the browser, use the Vercel AI SDK lane in [AI Integration Guide](./AI_INTEGRATION.md).

## 2. Paste A Minimal App

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
          placeholder: 'you@example.com',
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
      // First mount: create the initial Continuum session snapshot.
      session.pushView(initialView);
    }
  }, [session]);

  if (!snapshot?.view) {
    // Nothing renders until the session has an active view snapshot.
    return null;
  }

  return (
    <>
      <StarterKitProviderChatBox
        providers={providers}
        title="Ask Continuum AI"
        description="Successful AI results apply back into this same session."
      />
      <ContinuumRenderer view={snapshot.view} />
    </>
  );
}

export default function App() {
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

## 3. Understand The Runtime Order

This is the order that matters:

1. `ContinuumProvider` creates or rehydrates the active session.
2. `session.pushView(initialView)` mounts the first view if nothing was restored.
3. `ContinuumRenderer` renders the current `snapshot.view`.
4. `StarterKitProviderChatBox` reads the same live session.
5. When you submit an instruction, `@continuum-dev/ai-engine` builds context from the current session.
6. The AI result is checked, then applied back into that same session.
7. The renderer re-renders from the updated snapshot.

That is the key mental model: the AI lane does not bypass the local Continuum session. It works through it.

## 4. Know Why `clock` Is Not In This Path

You do not need to supply a clock in this quick-start path because:

- `starter-kit-ai` sits on top of `react`, `session`, and `runtime`
- the session layer owns the runtime timeline details for you
- the lower-level `clock` concern only shows up when you work directly with the runtime boundary APIs

If you later drop down to `@continuum-dev/runtime`, see the runtime package README for the explicit clock contract.

## 5. Add Optional Session Debugging

If you want rewind, checkpoints, restore review, and proposal review UI while you learn the system:

```tsx
import { StarterKitSessionWorkbench } from '@continuum-dev/starter-kit-ai';

<StarterKitSessionWorkbench initialView={initialView} />
```

## 6. If You Need A Server Boundary Instead

The direct provider lane is the fastest path, but it is not the only path.

Use the Vercel AI SDK lane when you want:

- a server-backed route
- streamed Continuum updates
- file attachment handling
- provider credentials kept off the client

That path is documented in [AI Integration Guide](./AI_INTEGRATION.md) and backed by `@continuum-dev/vercel-ai-sdk-adapter`.

## 7. Run The Repository Example

The repository example app follows the Vercel AI SDK lane, not the direct provider lane from this quick start.

- app: [`apps/starter`](../apps/starter/README.md)
- guides it follows: [AI Integration Guide](./AI_INTEGRATION.md) and [Integration Guide](./INTEGRATION_GUIDE.md)

From the repository root:

```bash
npm run build:release-packages
npm run starter
```

## 8. What To Read Next

- [AI Integration Guide](./AI_INTEGRATION.md)
- [Integration Guide](./INTEGRATION_GUIDE.md)
- [`@continuum-dev/starter-kit-ai`](../packages/starter-kit-ai/README.md)
- [`@continuum-dev/vercel-ai-sdk-adapter`](../packages/vercel-ai-sdk-adapter/README.md)
- [View Contract Reference](./VIEW_CONTRACT.md)
