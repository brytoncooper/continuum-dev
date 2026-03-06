# Quick Start

Get a working Continuum React integration in a few minutes.

## 1) Install

```bash
npm install @continuum-dev/react react
```

`@continuum-dev/react` includes `@continuum-dev/session` and `@continuum-dev/contract` as dependencies.

## 2) Define Your Component Map

Create React components for each node type your views contain.

```tsx
// components.tsx
import type { NodeValue } from '@continuum-dev/contract';
import type { ContinuumNodeMap, ContinuumNodeProps } from '@continuum-dev/react';

function FieldRenderer({ value, onChange, definition }: ContinuumNodeProps) {
  if (definition.type !== 'field') {
    return null;
  }

  const current = value as NodeValue | undefined;
  const label = definition.label ?? definition.key ?? definition.id;

  if (definition.dataType === 'boolean') {
    return (
      <label>
        <input
          type="checkbox"
          checked={Boolean(current?.value)}
          onChange={(event) =>
            onChange({ value: event.target.checked, isDirty: true } as NodeValue)
          }
        />
        {label}
      </label>
    );
  }

  const text = String(current?.value ?? '');
  return (
    <label>
      {label}
      <input
        value={text}
        onChange={(event) =>
          onChange({ value: event.target.value, isDirty: true } as NodeValue)
        }
      />
    </label>
  );
}

function GroupRenderer({ definition, children }: ContinuumNodeProps) {
  if (definition.type !== 'group') {
    return null;
  }
  return (
    <fieldset>
      <legend>{definition.label ?? definition.key ?? definition.id}</legend>
      <div style={{ display: 'grid', gap: 8 }}>{children}</div>
    </fieldset>
  );
}

export const componentMap: ContinuumNodeMap = {
  field: FieldRenderer,
  group: GroupRenderer,
};
```

## 3) Wrap Your App With `ContinuumProvider`

```tsx
// App.tsx
import { ContinuumProvider } from '@continuum-dev/react';
import { componentMap } from './components';
import { MyPage } from './MyPage';

export default function App() {
  return (
    <ContinuumProvider components={componentMap} persist="localStorage">
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
import type { ViewDefinition } from '@continuum-dev/contract';
import {
  ContinuumRenderer,
  useContinuumSession,
  useContinuumSnapshot,
} from '@continuum-dev/react';

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

For AI-generated views, use `@continuum-dev/prompts` to keep system prompts and correction loops consistent.

```bash
npm install @continuum-dev/prompts
```

## Next Steps

- [Integration Guide](INTEGRATION_GUIDE.md) - production React patterns
- [AI Integration Guide](AI_INTEGRATION.md) - prompt and correction-loop setup
- [View Contract Reference](VIEW_CONTRACT.md) - complete `ViewDefinition` contract
- [Root Package Overview](../README.md#packages) - package map and status