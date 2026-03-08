# Quick Start

Get a working Continuum React integration in a few minutes.

## 1) Install

```bash
npm install @continuum-dev/starter-kit react
```

`@continuum-dev/starter-kit` is the fastest path: it includes the opinionated primitives, a default component map, prompt helpers, and the headless React layer underneath.

If you want to stay headless from the start instead, install:

```bash
npm install @continuum-dev/react @continuum-dev/core react
```

## 2) Define Your Component Map

The Starter Kit ships with a default component map, so you can render immediately and customize later.

```tsx
import { starterKitComponentMap } from '@continuum-dev/starter-kit';
```

## 3) Wrap Your App With `ContinuumProvider`

```tsx
// App.tsx
import { ContinuumProvider, starterKitComponentMap } from '@continuum-dev/starter-kit';
import { MyPage } from './MyPage';

export default function App() {
  return (
    <ContinuumProvider components={starterKitComponentMap} persist="localStorage">
      <MyPage />
    </ContinuumProvider>
  );
}
```

`persist="localStorage"` enables automatic rehydration and persistence.

## 4) Push a View and Render It

```tsx
// MyPage.tsx
import { useEffect } from 'react';
import type { ViewDefinition } from '@continuum-dev/core';
import {
  ContinuumRenderer,
  useContinuumSession,
  useContinuumSnapshot,
} from '@continuum-dev/starter-kit';

const initialView: ViewDefinition = {
  viewId: 'profile-form',
  version: '1.0.0',
  nodes: [
    {
      id: 'profile',
      type: 'group',
      key: 'profile',
      label: 'Profile',
      children: [
        { id: 'name', type: 'field', dataType: 'string', key: 'name', label: 'Name' },
        { id: 'email', type: 'field', dataType: 'string', key: 'email', label: 'Email' },
        { id: 'agree', type: 'field', dataType: 'boolean', key: 'agree', label: 'Agree' },
      ],
    },
  ],
};

export function MyPage() {
  const session = useContinuumSession();
  const snapshot = useContinuumSnapshot();

  useEffect(() => {
    if (!session.getSnapshot()) {
      session.pushView(initialView);
    }
  }, [session]);

  if (!snapshot?.view) {
    return <div>Loading...</div>;
  }

  return <ContinuumRenderer view={snapshot.view} />;
}
```

At this point, form edits survive refresh.

## 5) Evolve the View While Preserving User State

When your AI/backend sends a new version, push it:

```typescript
session.pushView({
  viewId: 'profile-form',
  version: '2.0.0',
  nodes: [
    {
      id: 'profile',
      type: 'group',
      key: 'profile',
      label: 'Profile',
      children: [
        { id: 'full_name', type: 'field', dataType: 'string', key: 'name', label: 'Full Name' },
        { id: 'email', type: 'field', dataType: 'string', key: 'email', label: 'Email' },
        { id: 'phone', type: 'field', dataType: 'string', key: 'phone', label: 'Phone' },
        { id: 'agree', type: 'field', dataType: 'boolean', key: 'agree', label: 'Agree' },
      ],
    },
  ],
});
```

- `name` value carries to `full_name` because the semantic `key` is still `name`
- unchanged nodes keep their data
- new nodes start empty

## 6) Add Rewind and Diagnostics

```tsx
import { useContinuumDiagnostics, useContinuumSession } from '@continuum-dev/react';

function Devtools() {
  const session = useContinuumSession();
  const { checkpoints, issues, resolutions } = useContinuumDiagnostics();

  return (
    <div>
      <button
        onClick={() => {
          const previous = checkpoints[checkpoints.length - 2];
          if (previous) {
            session.rewind(previous.checkpointId);
          }
        }}
      >
        Undo
      </button>

      <pre>{JSON.stringify({ issueCount: issues.length, resolutions }, null, 2)}</pre>
    </div>
  );
}
```

## 7) Wire Actions

Register a handler and render an action button:

```tsx
// In your session setup
const session = createSession({
  actions: {
    submit: {
      registration: { label: 'Submit' },
      handler: async (ctx) => {
        await fetch('/api/submit', { method: 'POST', body: JSON.stringify(ctx.snapshot.values) });
        return { success: true };
      },
    },
  },
});

// In your component map
import { useContinuumAction } from '@continuum-dev/react';

const components = {
  action: ({ definition }) => {
    const { dispatch, isDispatching } = useContinuumAction(definition.intentId);
    return <button disabled={isDispatching} onClick={() => dispatch(definition.id)}>{definition.label}</button>;
  },
};
```

## 8) Optional: Use Prompt Helpers

The Starter Kit re-exports the prompt helpers, so you can import them from the same package surface.

```bash
npm install @continuum-dev/starter-kit react
```

## Next Steps

- [Integration Guide](INTEGRATION_GUIDE.md) - production React patterns
- [AI Integration Guide](AI_INTEGRATION.md) - prompt and correction-loop setup
- [View Contract Reference](VIEW_CONTRACT.md) - complete `ViewDefinition` contract
- [Root Package Overview](../README.md#packages) - package map and status