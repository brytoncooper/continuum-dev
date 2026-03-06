# ♾️ @continuum-dev/react

**Build interfaces that can change at runtime without hand-building the continuity layer yourself.**

Most React apps are written with one giant assumption: **the UI shape is basically fixed.**

That works great right up until your app starts doing things like:

- generating UI from AI output
- assembling screens from schemas
- rebuilding flows from workflow state
- streaming new layouts mid-session
- rendering dynamic forms that need persistence, undo, and conflict handling

At that point, the hard part is no longer just rendering data.

The hard part becomes:

- keeping user input attached to changing UI
- preserving state across structural changes
- preventing system updates from clobbering in-progress edits
- wiring nested collections without inventing a weird local-state framework
- recovering safely when generated nodes are incomplete, invalid, or unexpected

That is the hole Continuum fills.

`@continuum-dev/react` is the React layer for **Continuum**: a system for building interfaces that evolve at runtime while still feeling stable, stateful, and production-grade.

It is the point where the structural logic of `@continuum-dev/runtime` and the session model of `@continuum-dev/session` turn into a real user experience.

You bring your own components.  
Continuum handles the continuity layer underneath.

---

## The "ohhhh" moment

### Without Continuum

Your app receives a new UI shape.

Now you need custom logic for:

- mapping changing nodes back to live state
- preserving user edits across view updates
- hydrating and persisting dynamic session state
- resolving user edits vs system updates
- handling nested collection item state
- preventing one broken dynamic node from blanking the whole screen

That usually starts as "just a few helpers" and quietly turns into a strange in-house framework.

### With Continuum

You:

- push a new `ViewDefinition`
- render it through your React component map
- read and update node state with hooks
- persist and hydrate the session
- resolve conflicts and suggestions when needed
- get collections, diagnostics, fallbacks, and per-node error isolation built in

Same React.  
Same design system.  
Way less glue code.

---

## What Continuum actually is

Continuum splits the problem into clear layers:

- `@continuum-dev/contract` defines shared types
- `@continuum-dev/runtime` reconciles evolving views and state
- `@continuum-dev/session` owns live state, history, persistence, and proposals
- `@continuum-dev/react` renders all of that into React

This package is the React binding.

It does **not** replace your design system.  
It does **not** force a visual style.  
It does **not** own your app shell.

It gives you a better runtime model for interfaces that are not fully static.

---

## Why this feels different

### It renders change, not just data

Most libraries help you render a structure once.

Continuum is built for cases where the structure itself evolves during the session. The job is not just to render the latest tree. The job is to keep the interface usable while that tree changes.

### It is built to stay fast as views grow

`@continuum-dev/react` uses an external-store fan-out model powered by `useSyncExternalStore`.

In practice, that means updates stay focused: components subscribe to specific session state instead of forcing broad rerenders across the whole dynamic view.

### It fails safer

Every rendered node is wrapped in `NodeErrorBoundary`.

If one dynamic component blows up because a generated node is malformed or unexpected, the rest of the screen can keep working.

### It stays headless

Continuum provides structure, reconciliation, and session wiring.  
You keep full control over components, branding, styling, and UX.

---

## Install

```bash
npm install @continuum-dev/react @continuum-dev/session @continuum-dev/contract
```

Peer dependency: `react >= 18`.

## 60-second example

This example maps your design system components to dynamic node types and renders a live Continuum view.

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

const components: ContinuumNodeMap = {
  field: ({ value, onChange, definition }: ContinuumNodeProps) => (
    <label style={{ display: 'grid', gap: 6 }}>
      <span>{definition.label ?? definition.key ?? definition.id}</span>
      <input
        value={typeof value?.value === 'string' ? value.value : ''}
        onChange={(e) =>
          onChange({
            value: e.target.value,
            isDirty: true,
          } as NodeValue)
        }
      />
    </label>
  ),
  group: ({ children }: ContinuumNodeProps) => (
    <section style={{ display: 'grid', gap: 12 }}>{children}</section>
  ),
};

const initialView: ViewDefinition = {
  viewId: 'demo',
  version: '1',
  nodes: [
    {
      id: 'profile',
      type: 'group',
      children: [
        {
          id: 'email',
          type: 'field',
          dataType: 'string',
          key: 'user.email',
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

  return <ContinuumRenderer view={snapshot.view} />;
}

export function App() {
  return (
    <ContinuumProvider components={components} persist="localStorage">
      <main>
        <h1>Profile</h1>
        <Screen />
      </main>
    </ContinuumProvider>
  );
}
```

---

## Mental model

There are three big ideas behind this package.

1. You render views, not hardcoded screens.  
   The renderer walks a `ViewDefinition` tree and resolves each node through your component map.

2. State lives in the session.  
   Your components read current values from the active Continuum session and write updates back into it.

3. Dynamic interfaces need production behavior.  
   Persistence, diagnostics, conflict handling, collection state, fallbacks, and recovery are core parts of the model.

---

## Core API

### `ContinuumProvider`

`ContinuumProvider` creates and owns a Continuum session for a React subtree. It can:

- create a fresh session
- hydrate from storage
- expose session and internal store through context
- persist updates back to storage
- stay stable through React Strict Mode replay behavior

```tsx
<ContinuumProvider components={components} persist="localStorage">
  <App />
</ContinuumProvider>
```

#### Props

| Prop | Type | Description |
| --- | --- | --- |
| `components` | `ContinuumNodeMap` | Required map of node type to React component. |
| `persist` | `'localStorage' \| 'sessionStorage' \| false` | Optional browser storage strategy. |
| `storageKey` | `string` | Optional storage key. Default: `continuum_session`. |
| `maxPersistBytes` | `number` | Optional max serialized payload size before persistence is skipped. |
| `onPersistError` | `(error: ContinuumPersistError) => void` | Optional callback for `size_limit` and `storage_error`. |
| `sessionOptions` | `SessionOptions` | Optional session configuration passed to hydration/creation. |
| `children` | `React.ReactNode` | React subtree rendered inside the provider. |

### `ContinuumRenderer`

Renders a `ViewDefinition` tree through your component map.

```tsx
<ContinuumRenderer view={snapshot.view} />
```

#### What it does

- resolves node components by `definition.type`
- falls back to `components.default` if provided
- otherwise uses built-in `FallbackComponent`
- wraps each node in `NodeErrorBoundary`
- supports hidden nodes
- supports nested container nodes
- supports built-in collection behavior
- passes canonical scoped `nodeId` values to your components

### Hooks

#### `useContinuumState(nodeId)`

Primary hook for data-bearing components.

```ts
const [value, setValue] = useContinuumState('user_email');
```

#### `useContinuumConflict(nodeId)`

Use this when system proposals should not overwrite in-progress user edits automatically.

```ts
const { hasConflict, proposal, accept, reject } = useContinuumConflict('user_email');
```

#### `useContinuumDiagnostics()`

Returns timeline and reconciliation metadata:

- `issues`
- `diffs`
- `resolutions`
- `checkpoints`

```ts
const { issues, checkpoints } = useContinuumDiagnostics();
```

#### `useContinuumViewport(nodeId)`

Tracks non-data state (focus, expansion, scroll, zoom, offsets) inside the session model.

```ts
const [viewport, setViewport] = useContinuumViewport('table');
```

#### `useContinuumSession()`

Returns the active session for full session API access.

```ts
const session = useContinuumSession();
```

#### `useContinuumSnapshot()`

Subscribes to the full current `ContinuitySnapshot`.

```ts
const snapshot = useContinuumSnapshot();
```

#### `useContinuumHydrated()`

Indicates whether provider initialization came from persisted storage.

```ts
const hydrated = useContinuumHydrated();
```

#### `useContinuumSuggestions()`

Scans current snapshot values for suggestions and provides accept-all / reject-all actions.

```ts
const { hasSuggestions, acceptAll, rejectAll } = useContinuumSuggestions();
```

---

## The node contract

Each component in your `components` map receives this prop shape:

```ts
import type { NodeValue, ViewNode } from '@continuum-dev/contract';

interface ContinuumNodeProps<T = NodeValue> {
  value: T | undefined;
  onChange: (value: T) => void;
  definition: ViewNode;
  nodeId?: string;
  children?: React.ReactNode;
  [prop: string]: unknown;
}
```

`nodeId` is the canonical scoped id used by the renderer.  
For nested nodes, it can look like `group/field`.

---

## Example: conflict UI

```tsx
import { useContinuumConflict } from '@continuum-dev/react';

function EmailConflict({ nodeId }: { nodeId: string }) {
  const { hasConflict, proposal, accept, reject } = useContinuumConflict(nodeId);

  if (!hasConflict) {
    return null;
  }

  return (
    <div>
      <div>Suggested value: {String(proposal?.value ?? '')}</div>
      <button onClick={accept}>Accept</button>
      <button onClick={reject}>Reject</button>
    </div>
  );
}
```

## Example: suggestion banner

```tsx
import { useContinuumSuggestions } from '@continuum-dev/react';

function SuggestionBanner() {
  const { hasSuggestions, acceptAll, rejectAll } = useContinuumSuggestions();

  if (!hasSuggestions) {
    return null;
  }

  return (
    <div>
      <span>Suggested updates are available.</span>
      <button onClick={acceptAll}>Accept all</button>
      <button onClick={rejectAll}>Reject all</button>
    </div>
  );
}
```

## Example: undo with checkpoints

```tsx
import { useContinuumDiagnostics, useContinuumSession } from '@continuum-dev/react';

function UndoButton() {
  const session = useContinuumSession();
  const { checkpoints } = useContinuumDiagnostics();

  const undo = () => {
    const previous = checkpoints[checkpoints.length - 2];
    if (previous) {
      session.rewind(previous.checkpointId);
    }
  };

  return <button onClick={undo}>Undo last change</button>;
}
```

---

## Collections

`@continuum-dev/react` includes built-in collection node support:

- initial item creation from `minItems`
- add behavior constrained by `maxItems`
- remove behavior constrained by `minItems`
- scoped item state storage
- default template values
- canonical nested ids for collection children

Rendered collection controls include attributes like:

- `data-continuum-collection-add`
- `data-continuum-collection-remove`
- `data-continuum-collection-item`

You get practical collection behavior out of the box while still controlling the visual wrapper component.

---

## Fallbacks and failure isolation

Dynamic interfaces are messy in real production environments. This package is designed to fail more safely.

### Unknown node types

Node resolution order:

1. `components[definition.type]`
2. `components.default`
3. built-in `FallbackComponent`

The fallback renders:

- unknown node type information
- editable text input when possible
- raw node definition for diagnostics

### Per-node error boundaries

Every rendered node is wrapped in `NodeErrorBoundary`.

If one component crashes while rendering a dynamic node, sibling regions can keep working.

---

## Persistence behavior

When `persist` is enabled, provider-level session persistence supports:

- hydration on provider creation
- persistence writes through the session layer
- optional payload size limits with `maxPersistBytes`
- optional `onPersistError` callback for:
  - `size_limit`
  - `storage_error`

Supported storage targets:

- `localStorage`
- `sessionStorage`

Example:

```tsx
<ContinuumProvider
  components={components}
  persist="localStorage"
  maxPersistBytes={100_000}
  onPersistError={(error) => {
    console.error(error);
  }}
>
  <App />
</ContinuumProvider>
```

---

## When to use this package

`@continuum-dev/react` is a strong fit when UI can change during a session and is driven by:

- AI output
- schemas
- workflows
- server-driven definitions
- dynamic internal tools
- resumable multi-step experiences
- long-lived interfaces where persistence and history matter

If your UI is fully static and your state model is simple, you may not need Continuum.

---

## Ecosystem

Continuum packages:

- `@continuum-dev/contract`: shared types and view/data contracts
- `@continuum-dev/runtime`: stateless reconciliation engine
- `@continuum-dev/session`: live session, persistence, proposals, checkpoints, history
- `@continuum-dev/react`: React bindings and renderer

---

## In one sentence

If React is your UI engine, `@continuum-dev/react` is the layer that lets dynamic, evolving interfaces stop feeling fragile.

## License

MIT
