# @continuum-dev/react

Build dynamic, AI-driven React UIs without losing user state.

`@continuum-dev/react` gives you a headless renderer + session layer for view-defined interfaces. Your agent can evolve the UI structure while Continuum carries user input forward safely.

## Why Teams Use It

- Keep user input stable across AI-generated view updates.
- Ship headless UI control: your components, your styling, your brand.
- Get built-in persistence, checkpoints, rewind, and diagnostics.
- Integrate quickly with plain React state patterns.

## Install

```bash
npm install @continuum-dev/react @continuum-dev/contract
```

Peer dependency: `react >= 18`.

## 60-Second Setup

```tsx
import { useEffect } from 'react';
import type { NodeValue, ViewDefinition } from '@continuum-dev/contract';
import {
  ContinuumProvider,
  ContinuumRenderer,
  useContinuumSession,
  useContinuumSnapshot,
  type ContinuumNodeMap,
  type ContinuumNodeProps,
} from '@continuum-dev/react';

function Field({ value, onChange, definition }: ContinuumNodeProps) {
  const text = typeof (value as NodeValue | undefined)?.value === 'string'
    ? String((value as NodeValue).value)
    : '';

  return (
    <label>
      {definition.key ?? definition.id}
      <input
        value={text}
        onChange={(e) => onChange({ value: e.target.value } as NodeValue)}
      />
    </label>
  );
}

const componentMap: ContinuumNodeMap = {
  field: Field,
};

const initialView: ViewDefinition = {
  viewId: 'demo',
  version: '1',
  nodes: [{ id: 'name', key: 'name', type: 'field', dataType: 'string' }],
};

function Screen() {
  const session = useContinuumSession();
  const snapshot = useContinuumSnapshot();

  useEffect(() => {
    if (!session.getSnapshot()) {
      session.pushView(initialView);
    }
  }, [session]);

  if (!snapshot?.view) return null;
  return <ContinuumRenderer view={snapshot.view} />;
}

export function App() {
  return (
    <ContinuumProvider components={componentMap} persist="localStorage">
      <Screen />
    </ContinuumProvider>
  );
}
```

## Headless by Design

Continuum does not impose a design system. You own all rendering and style decisions through your component map.

- `ContinuumRenderer` handles structure and state wiring.
- Your components handle UX, visual language, and accessibility.
- The built-in fallback is intentionally unstyled.

## Core API

### `ContinuumProvider`

Owns session lifecycle and optional storage rehydration/persistence.

| Prop | Type | Default |
| --- | --- | --- |
| `components` | `ContinuumComponentMap` | required |
| `persist` | `'localStorage' \| 'sessionStorage' \| false` | `false` |
| `storageKey` | `string` | `'continuum_session'` |
| `maxPersistBytes` | `number` | — |
| `onPersistError` | `(error: ContinuumPersistError) => void` | — |
| `sessionOptions` | `SessionOptions` | — |
| `children` | `React.ReactNode` | required |

### `ContinuumRenderer`

Renders `ViewDefinition` nodes through your component map:

```tsx
<ContinuumRenderer view={snapshot.view} />
```

### Hooks

- `useContinuumSession()`: read/write session API
- `useContinuumState(nodeId)`: node-level state subscribe/update
- `useContinuumSnapshot()`: full snapshot subscribe
- `useContinuumViewport(nodeId)`: viewport metadata read/write
- `useContinuumDiagnostics()`: issues/diffs/resolutions/checkpoints
- `useContinuumHydrated()`: whether initial state came from storage

## What Value Looks Like in Production

- **Agent-driven forms:** evolve schema versions while preserving edits.
- **Multi-step workflows:** checkpoint every push and rewind instantly.
- **Regulated surfaces:** inspect diffs/issues/resolutions for auditability.
- **Performance-sensitive UIs:** subscribe at node granularity instead of rerendering the whole tree.

## Links

- [Root README](../../README.md)
- [Quick Start](../../docs/QUICK_START.md)
- [Integration Guide](../../docs/INTEGRATION_GUIDE.md)
