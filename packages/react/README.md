# @continuum-dev/react

```bash
npm install @continuum-dev/react @continuum-dev/core react
```

## Why It Exists

`@continuum-dev/core` gives you the Continuum model and session behavior, but a React app still needs a provider, a renderer, and subscription-friendly hooks.

`@continuum-dev/react` exists so you can render changing Continuum views with your own React components without rebuilding:

- session bootstrapping and hydration
- focused subscriptions for node values, snapshots, streams, and diagnostics
- collection item scoping
- fallback rendering for unknown node types
- per-node error isolation

If Continuum is the continuity engine, `@continuum-dev/react` is the headless React binding that turns it into a normal component tree.

## How It Works

- `ContinuumProvider` creates or hydrates a Continuum session through `@continuum-dev/core` and wraps it in a React-friendly external store.
- `ContinuumRenderer` walks a `ViewDefinition` tree and resolves each node through your `components` map.
- Rendered node components receive `value`, `onChange`, `definition`, `nodeId`, and optional streaming or collection props.
- Hooks such as `useContinuumState`, `useContinuumSnapshot`, `useContinuumDiagnostics`, and `useContinuumStreaming` subscribe to focused slices of session state.
- Writes go back through the session, which updates the underlying snapshot and then fans those updates back out through the provider store.
- Optional persistence uses the session layer, not a separate React state cache.

### Normal React Order

1. mount `ContinuumProvider`
2. hydrate an existing session or push the first view
3. read the active snapshot
4. render `snapshot.view` through `ContinuumRenderer`
5. let components call `onChange` or hooks to write canonical node values
6. let the session emit the next snapshot, streams, issues, and checkpoints
7. optionally persist the session ledger to browser storage

## What It Is

`@continuum-dev/react` is a headless React binding package over `@continuum-dev/core`.

Import everything from the package root:

```ts
import {
  ContinuumProvider,
  ContinuumRenderer,
  useContinuumSession,
  useContinuumSnapshot,
  useContinuumState,
  type ContinuumNodeMap,
  type ContinuumNodeProps,
} from '@continuum-dev/react';
```

The public root export includes:

- `ContinuumProvider`
- `ContinuumRenderer`
- all public hooks
- `NodeErrorBoundary`
- `FallbackComponent`
- advanced React context exports
- `ContinuumNodeProps`, `ContinuumNodeMap`, `ContinuumProviderProps`, and related types

There are no public subpath imports.

## Simplest Way To Use It

Most apps only need this path:

1. define a `ContinuumNodeMap`
2. wrap your subtree in `ContinuumProvider`
3. push the first `ViewDefinition` into the session if nothing was hydrated
4. render the live `snapshot.view` through `ContinuumRenderer`
5. let node components read `value` and write through `onChange`

### Minimal Flow

```tsx
import { useEffect } from 'react';
import type { NodeValue, ViewDefinition } from '@continuum-dev/core';
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
      <span>{definition.id}</span>
      <input
        value={typeof value?.value === 'string' ? value.value : ''}
        onChange={(event) =>
          // Writes the next canonical node value into the active session.
          onChange({ value: event.target.value, isDirty: true } as NodeValue)
        }
      />
    </label>
  ),
  group: ({ children }: ContinuumNodeProps) => (
    // Container nodes render their Continuum children through your layout.
    <section style={{ display: 'grid', gap: 12 }}>{children}</section>
  ),
};

const initialView: ViewDefinition = {
  viewId: 'profile',
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
      // First mount: seed the session with the first view version.
      session.pushView(initialView);
    }
  }, [session]);

  if (!snapshot?.view) {
    // Nothing to render until the session has an active snapshot.
    return null;
  }

  // Always render the current live view from the session snapshot.
  return <ContinuumRenderer view={snapshot.view} />;
}

export function App() {
  return (
    <ContinuumProvider components={components}>
      <Screen />
    </ContinuumProvider>
  );
}
```

### What Is Required

- React 18 or newer
- a `ContinuumProvider`
- a component map entry for each node `type` you expect to render, or a `default` fallback
- an initial `ViewDefinition`
- components that can accept `ContinuumNodeProps`

## Other Options

### Persistence And Hydration

Use provider persistence when the React subtree should resume from browser storage.

- `persist` supports `false`, `'localStorage'`, and `'sessionStorage'`
- `storageKey` changes the storage key; the default is `continuum_session`
- `maxPersistBytes` skips oversized writes
- `onPersistError` receives `size_limit` and `storage_error`
- `useContinuumHydrated()` tells you whether the provider found a persisted payload key when it started

Example:

```tsx
<ContinuumProvider
  components={components}
  persist="localStorage"
  storageKey="profile-session"
  maxPersistBytes={100_000}
  onPersistError={(error) => {
    console.error(error);
  }}
>
  <App />
</ContinuumProvider>
```

### State, Snapshots, And Session Access

Use these hooks when mapped node components or app-level UI need direct access to Continuum state:

- `useContinuumState(nodeId)`
  - reads and writes one canonical node value
- `useContinuumSnapshot()`
  - returns the current live `ContinuitySnapshot`
- `useContinuumCommittedSnapshot()`
  - returns the last committed snapshot during foreground streaming
- `useContinuumSession()`
  - returns the full session API
- `useContinuumFocus(nodeId)`
  - reads and writes session-level focus state for one canonical node id

Canonical node ids are the same flat ids used by Continuum data:

- top-level field `email`
  - `email`
- nested field inside `profile`
  - `profile/email`

### Diagnostics, Conflicts, Suggestions, And Actions

Use these hooks when the UI needs more than basic state reads and writes:

- `useContinuumDiagnostics()`
  - returns `issues`, `diffs`, `resolutions`, and `checkpoints`
- `useContinuumConflict(nodeId)`
  - returns pending proposal state plus `accept()` and `reject()`
- `useContinuumSuggestions()`
  - scans current node values for active suggestions and exposes `acceptAll()` and `rejectAll()`
- `useContinuumAction(intentId)`
  - dispatches a registered action and tracks `isDispatching` and `lastResult`

### Collections

Collection rendering is built into `ContinuumRenderer`.

- the collection node renders through your mapped `collection` component
- collection root components receive `canAdd`, `canRemove`, `onAdd`, and `onRemove`
- template root components receive `itemIndex`, `canRemove`, and `onRemove`
- item children automatically read and write item-scoped values through the collection node
- the renderer does not inject wrapper elements or control markup for you

### Streams, Preview Rendering, And Restore Review Flows

Use these APIs when the rendered tree can change while the session is live:

- `useContinuumStreams()`
  - returns raw session stream metadata
- `useContinuumStreaming()`
  - returns `streams`, `activeStream`, and `isStreaming` for foreground streams
- rendered node components receive `isStreaming`, `buildState`, and `streamStatus` when a foreground stream touches that node or subtree
- `snapshotOverride` changes which snapshot data `ContinuumRenderer` reads from
- `renderScope` controls where writes go while rendering that snapshot, usually `{ kind: 'live' }` or `{ kind: 'draft', streamId }`
- `useContinuumRestoreReviews()` and `useContinuumRestoreCandidates(nodeId)` help drive detached-value restore review UI

### Fallbacks And Error Isolation

Dynamic trees are not always clean. This package fails safer in two ways:

- node resolution order is `components[definition.type]`, then `components.default`, then `FallbackComponent`
- every rendered node is wrapped in `NodeErrorBoundary`

`FallbackComponent` shows the unknown type, an editable best-effort input, and the raw node definition for diagnostics.

### Advanced Exports

Most apps only need `ContinuumProvider`, `ContinuumRenderer`, and the hooks.

If you are building custom tooling, the package also exports:

- `ContinuumContext`
- `ContinuumRenderSnapshotContext`
- `ContinuumRenderScopeContext`
- `NodeStateScopeContext`
- `FallbackComponent`
- `NodeErrorBoundary`

## Related Packages

- `@continuum-dev/core`
  - the headless facade below React
- `@continuum-dev/session`
  - use this directly when you need lower-level session timeline or persistence control outside React
- `@continuum-dev/starter-kit`
  - an opinionated UI layer built on top of `@continuum-dev/react`

## Dictionary Contract

### Core Terms

- `component map`
  - the object that maps Continuum node `type` values to React components
- `canonical node id`
  - the flat data id used by Continuum, such as `email` or `profile/email`
- `live snapshot`
  - the current `{ view, data }` pair from the active session
- `committed snapshot`
  - the last durable snapshot before an in-flight foreground stream finishes
- `render scope`
  - the target scope for writes while rendering, usually live or a specific draft stream
- `hydrated`
  - a provider startup where a persisted storage key was already present

### Public Root Exports

```ts
ContinuumProvider
ContinuumRenderer
useContinuumAction
useContinuumConflict
useContinuumDiagnostics
useContinuumFocus
useContinuumHydrated
useContinuumRestoreCandidates
useContinuumRestoreReviews
useContinuumSession
useContinuumCommittedSnapshot
useContinuumSnapshot
useContinuumState
useContinuumStreaming
useContinuumStreams
useContinuumSuggestions
ContinuumContext
ContinuumRenderScopeContext
ContinuumRenderSnapshotContext
NodeStateScopeContext
NodeErrorBoundary
FallbackComponent
```

### `ContinuumProviderProps`

```ts
{
  components: ContinuumNodeMap;
  persist?: 'sessionStorage' | 'localStorage' | false;
  storageKey?: string;
  maxPersistBytes?: number;
  onPersistError?: (error: ContinuumPersistError) => void;
  sessionOptions?: SessionOptions;
  children: React.ReactNode;
}
```

### `ContinuumRendererProps`

```ts
{
  view: ViewDefinition;
  snapshotOverride?: ContinuitySnapshot | null;
  renderScope?: DetachedRestoreScope | null;
}
```

### `ContinuumPersistError.reason`

```ts
'size_limit' | 'storage_error'
```

### `DetachedRestoreScope.kind`

```ts
'live' | 'draft'
```

### `ContinuumNodeBuildState`

```ts
'building' | 'ready' | 'committed' | 'error'
```

### `ContinuumNodeStreamStatus.level`

```ts
'info' | 'success' | 'warning' | 'error'
```

### `ContinuumNodeProps`

```ts
{
  value: NodeValue | undefined;
  hasSuggestion?: boolean;
  suggestionValue?: unknown;
  onChange: (value: NodeValue) => void;
  definition: ViewNode;
  nodeId?: string;
  isStreaming?: boolean;
  buildState?: 'building' | 'ready' | 'committed' | 'error';
  streamStatus?: {
    status: string;
    level: 'info' | 'success' | 'warning' | 'error';
    subtree?: boolean;
  };
  children?: React.ReactNode;
  [prop: string]: unknown;
}
```

## License

MIT
