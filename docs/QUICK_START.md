# Quick Start

Get a working Continuum app on screen fast, then learn how view updates preserve user state.

This guide uses `@continuum-dev/starter-kit`, which is now the slim preset layer for rendering, hooks, styles, and session tooling.

## Run the same flow in this repository

The [`apps/starter`](../apps/starter) app follows this guide end to end.

```bash
npm run starter
```

That serves **http://localhost:4305/** (root path `/`). The same minimal UI is also available inside the full demo at **`/reference/starter`** when you run `npm run demo`.

## What you will build

By the end of this guide you will have:

- a React app wrapped in `ContinuumProvider`
- a rendered `ViewDefinition`
- local persistence across refresh
- a view update that preserves matching user data

## 1. Install the fastest path

```bash
npm install @continuum-dev/starter-kit react
```

Use the starter kit if you want:

- a default component map
- ready-to-use primitives
- Continuum React hooks from the same package surface
- built-in style APIs
- session tooling like `StarterKitSessionWorkbench`

If you want a fully headless React setup instead, install:

```bash
npm install @continuum-dev/react @continuum-dev/core react
```

If you expect to add AI to a custom system later, start by learning the explicit stack instead of a convenience facade:

```bash
npm install @continuum-dev/react @continuum-dev/session @continuum-dev/ai-engine react
```

Then add `@continuum-dev/vercel-ai-sdk-adapter` or `@continuum-dev/ai-connect` for your transport or provider path. If you already know you want one dependency edge, `@continuum-dev/ai-core` re-exports that stack as a convenience facade.

## 2. Wrap your app

Create your app shell with `ContinuumProvider`.

```tsx
import {
  ContinuumProvider,
  starterKitComponentMap,
} from '@continuum-dev/starter-kit';
import { Page } from './Page';

export default function App() {
  return (
    <ContinuumProvider
      components={starterKitComponentMap}
      persist="localStorage"
    >
      <Page />
    </ContinuumProvider>
  );
}
```

Why this matters:

- `components={starterKitComponentMap}` gives you a default renderer immediately
- `persist="localStorage"` makes the session survive refresh automatically

## 3. Push your first view

Create a simple `ViewDefinition` and render it from session state.

```tsx
import { useEffect } from 'react';
import {
  ContinuumRenderer,
  useContinuumSession,
  useContinuumSnapshot,
  type ViewDefinition,
} from '@continuum-dev/starter-kit';

const initialView: ViewDefinition = {
  viewId: 'profile-form',
  version: '1',
  nodes: [
    {
      id: 'profile',
      type: 'group',
      key: 'profile',
      label: 'Profile',
      children: [
        {
          id: 'name',
          type: 'field',
          dataType: 'string',
          key: 'name',
          label: 'Name',
        },
        {
          id: 'email',
          type: 'field',
          dataType: 'string',
          key: 'email',
          label: 'Email',
        },
        {
          id: 'agree',
          type: 'field',
          dataType: 'boolean',
          key: 'agree',
          label: 'Agree to terms',
        },
      ],
    },
  ],
};

export function Page() {
  const session = useContinuumSession();
  const snapshot = useContinuumSnapshot();

  useEffect(() => {
    if (!snapshot) {
      session.pushView(initialView);
    }
  }, [session, snapshot]);

  if (!snapshot?.view) {
    return null;
  }

  return <ContinuumRenderer view={snapshot.view} />;
}
```

At this point:

- the view is live
- state updates go into the active Continuum session
- refresh will rehydrate the session from storage

## 4. Update the view without losing user data

When your backend or AI sends a new version, push it into the same session:

```tsx
session.pushView({
  viewId: 'profile-form',
  version: '2',
  nodes: [
    {
      id: 'profile',
      type: 'group',
      key: 'profile',
      label: 'Profile',
      children: [
        {
          id: 'full_name',
          type: 'field',
          dataType: 'string',
          key: 'name',
          label: 'Full Name',
        },
        {
          id: 'email',
          type: 'field',
          dataType: 'string',
          key: 'email',
          label: 'Email',
        },
        {
          id: 'phone',
          type: 'field',
          dataType: 'string',
          key: 'phone',
          label: 'Phone',
        },
        {
          id: 'agree',
          type: 'field',
          dataType: 'boolean',
          key: 'agree',
          label: 'Agree to terms',
        },
      ],
    },
  ],
});
```

What happens here:

- the `name` value carries to `full_name` because the semantic key is still `name`
- `email` and `agree` keep their data
- `phone` starts empty because it is new

## 5. Inspect what happened

Continuum exposes diagnostics for every push:

```tsx
import { useContinuumDiagnostics } from '@continuum-dev/starter-kit';

export function DiagnosticsPanel() {
  const { issues, resolutions, checkpoints } = useContinuumDiagnostics();

  return (
    <pre>
      {JSON.stringify(
        {
          issueCount: issues.length,
          resolutionCount: resolutions.length,
          checkpointCount: checkpoints.length,
        },
        null,
        2
      )}
    </pre>
  );
}
```

## 6. Rewind to an earlier checkpoint

Every `pushView` creates an auto-checkpoint.

```tsx
import {
  useContinuumDiagnostics,
  useContinuumSession,
} from '@continuum-dev/starter-kit';

export function UndoButton() {
  const session = useContinuumSession();
  const { checkpoints } = useContinuumDiagnostics();

  return (
    <button
      onClick={() => {
        const previous = checkpoints[checkpoints.length - 2];
        if (previous) {
          session.rewind(previous.checkpointId);
        }
      }}
    >
      Undo last view change
    </button>
  );
}
```

## 7. Add actions

Action nodes can trigger registered handlers by `intentId`.

```tsx
import { useEffect } from 'react';
import {
  useContinuumAction,
  useContinuumSession,
} from '@continuum-dev/starter-kit';

export function RegisterActions() {
  const session = useContinuumSession();

  useEffect(() => {
    session.registerAction('submit', { label: 'Submit' }, async (context) => {
      await fetch('/api/submit', {
        method: 'POST',
        body: JSON.stringify(context.snapshot.values),
      });
      return { success: true };
    });
  }, [session]);

  return null;
}
```

## 8. Optional: add AI later

The rendering lane stays slim on purpose. If you want built-in AI UI later, add the optional packages instead of pulling AI wiring from `starter-kit` itself.

```bash
npm install @continuum-dev/starter-kit-ai
```

```tsx
import {
  createAiConnectProviders,
  getAiConnectModelCatalog,
  StarterKitProviderChatBox,
  StarterKitSessionWorkbench,
} from '@continuum-dev/starter-kit-ai';

const providers = createAiConnectProviders({
  include: ['openai', 'google'],
  openai: {
    apiKey: import.meta.env.VITE_OPENAI_API_KEY,
    model: 'gpt-5',
  },
  google: {
    apiKey: import.meta.env.VITE_GOOGLE_API_KEY,
  },
});

const models = getAiConnectModelCatalog(providers);

export function AiControls() {
  return (
    <>
      <StarterKitProviderChatBox
        providers={providers}
        models={models}
        mode="evolve-view"
      />
      <StarterKitSessionWorkbench initialView={initialView} />
    </>
  );
}
```

If you want custom AI UI instead of starter wrappers, move to the explicit AI runtime stack:

```bash
npm install @continuum-dev/react @continuum-dev/session @continuum-dev/ai-engine react
```

Add `@continuum-dev/vercel-ai-sdk-adapter` for the Vercel AI SDK path or `@continuum-dev/ai-connect` for built-in provider clients. If you prefer one convenience package after you understand the layers, `@continuum-dev/ai-core` is still available.

## 9. What to read next

- [Starter Kit README](../packages/starter-kit/README.md)
- [Starter reference app](REFERENCE_STARTER_APP.md)
- [Starter Kit AI README](../packages/starter-kit-ai/README.md)
- [Headless AI reference app](REFERENCE_HEADLESS_AI_APP.md)
- [Integration Guide](INTEGRATION_GUIDE.md)
- [AI Integration Guide](AI_INTEGRATION.md)
- [View Contract Reference](VIEW_CONTRACT.md)
