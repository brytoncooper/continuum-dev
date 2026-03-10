# Quick Start

Get a working Continuum app on screen fast, then learn how view updates preserve user state.

This guide uses `@continuum-dev/starter-kit`, which is the easiest public entry point.

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
- optional AI chat and session workbench primitives later

If you want a fully headless React setup instead, install:

```bash
npm install @continuum-dev/react @continuum-dev/core react
```

## 2. Wrap your app

Create your app shell with `ContinuumProvider`.

```tsx
import { ContinuumProvider, starterKitComponentMap } from '@continuum-dev/starter-kit';
import { Page } from './Page';

export default function App() {
  return (
    <ContinuumProvider components={starterKitComponentMap} persist="localStorage">
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

## 4. Update the view without losing the user’s data

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

- the `name` value carries to `full_name` because the semantic `key` is still `name`
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

This is useful for:

- AI view generation loops
- debugging unexpected detachments
- building internal tooling and audit panels

## 6. Rewind to an earlier checkpoint

Every `pushView` creates an auto-checkpoint.

```tsx
import { useContinuumDiagnostics, useContinuumSession } from '@continuum-dev/starter-kit';

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
import { useContinuumAction, useContinuumSession } from '@continuum-dev/starter-kit';

export function RegisterActions() {
  const session = useContinuumSession();

  useEffect(() => {
    session.registerAction(
      'submit',
      { label: 'Submit' },
      async (context) => {
        await fetch('/api/submit', {
          method: 'POST',
          body: JSON.stringify(context.snapshot.values),
        });
        return { success: true };
      }
    );
  }, [session]);

  return null;
}

export function SubmitButton({ intentId, nodeId, label }: { intentId: string; nodeId: string; label: string }) {
  const { dispatch, isDispatching } = useContinuumAction(intentId);

  return (
    <button disabled={isDispatching} onClick={() => dispatch(nodeId)}>
      {label}
    </button>
  );
}
```

## 8. Optional: add built-in AI controls

The starter kit also ships AI-focused UI primitives:

- `StarterKitProviderChatBox`
- `StarterKitSessionWorkbench`

```tsx
import {
  StarterKitProviderChatBox,
  StarterKitSessionWorkbench,
  createStarterKitGoogleProvider,
  createStarterKitOpenAiProvider,
} from '@continuum-dev/starter-kit';

const providers = [
  createStarterKitOpenAiProvider({
    apiKey: import.meta.env.VITE_OPENAI_API_KEY,
    model: 'gpt-5.4',
  }),
  createStarterKitGoogleProvider({
    apiKey: import.meta.env.VITE_GOOGLE_API_KEY,
  }),
];

export function AiControls() {
  return (
    <>
      <StarterKitProviderChatBox providers={providers} mode="evolve-view" />
      <StarterKitSessionWorkbench />
    </>
  );
}
```

Notes:

- if multiple providers are present, the chat box shows a provider selector automatically
- Anthropic support is optional
- if you want one convenience call, use `createStarterKitProviders(...)`

## 9. What to read next

Continue based on what you are doing next:

- [Starter Kit README](../packages/starter-kit/README.md) for the package-level surface
- [Integration Guide](INTEGRATION_GUIDE.md) for production patterns
- [AI Integration Guide](AI_INTEGRATION.md) for prompting and correction loops
- [View Contract Reference](VIEW_CONTRACT.md) for exact `ViewDefinition` rules
