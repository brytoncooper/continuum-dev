# @continuum/react

React bindings for the Continuum SDK.

Provides a context provider, a view-driven renderer, and hooks for accessing session state. Handles persistence to localStorage/sessionStorage automatically.

## Installation

```bash
npm install @continuum/react @continuum/contract
```

Peer dependency: `react` >= 18.

## Quick Start

```tsx
import {
  ContinuumProvider,
  ContinuumRenderer,
  useContinuumSession,
} from '@continuum/react';

const componentMap = {
  field: MyFieldComponent,
  group: MyGroupComponent,
  action: MyActionComponent,
  presentation: MyPresentationComponent,
};

function App() {
  return (
    <ContinuumProvider components={componentMap} persist="localStorage">
      <Page />
    </ContinuumProvider>
  );
}

function Page() {
  const session = useContinuumSession();
  const snapshot = useContinuumSnapshot();
  const view = {
    viewId: 'view-1',
    version: '1',
    nodes: [{ id: 'field', type: 'field', dataType: 'string' }],
  };

  useEffect(() => {
    session.pushView(view);
  }, []);

  return snapshot?.view ? <ContinuumRenderer view={snapshot.view} /> : null;
}
```

## Components

### `<ContinuumProvider>`

Wraps your application and manages the Continuum session.

**Props** (`ContinuumProviderProps`):

| Prop              | Type                                          | Default               | Description                                                                     |
| ----------------- | --------------------------------------------- | --------------------- | ------------------------------------------------------------------------------- |
| `components`      | `ContinuumComponentMap`                       | required              | Map of component type strings to React components                               |
| `persist`         | `'localStorage' \| 'sessionStorage' \| false` | `false`               | Where to persist session data                                                   |
| `storageKey`      | `string`                                      | `'continuum_session'` | Key used in storage                                                             |
| `maxPersistBytes` | `number`                                      | —                     | Optional max serialized payload size in bytes before writes are skipped         |
| `onPersistError`  | `(error: ContinuumPersistError) => void`      | —                     | Called for skipped writes (`size_limit`) and storage failures (`storage_error`) |
| `children`        | `React.ReactNode`                             | required              | Child elements                                                                  |

On mount, the provider attempts to rehydrate from storage. If rehydration succeeds, `useContinuumHydrated()` returns `true`. On every snapshot change, the session is automatically serialized back to storage. When `maxPersistBytes` is set and the payload exceeds the limit, the write is skipped and `onPersistError` is notified (or a warning is logged if no callback is provided).

### `<ContinuumRenderer>`

Renders a view by mapping each `ViewNode` to a React component from the component map.

```tsx
<ContinuumRenderer view={snapshot.view} />
```

**Props:**

| Prop   | Type             | Description        |
| ------ | ---------------- | ------------------ |
| `view` | `ViewDefinition` | The view to render |

Each component is wrapped in a `<div data-continuum-id={definition.id}>` for identification. Children are rendered recursively. If a component type isn't in the map, falls back to `componentMap['default']`, then to the built-in `FallbackComponent`.

### `<FallbackComponent>`

A built-in unstyled component rendered when a type isn't found in the component map. It shows the unknown type name, an editable input, and an expandable view definition viewer. Style it in your host app if desired.

## Hooks

### `useContinuumSession()`

Returns the `Session` object from the nearest `ContinuumProvider`.

```typescript
function useContinuumSession(): Session;
```

Throws if used outside a provider.

### `useContinuumState(nodeId)`

Reads and writes a single component's state. Uses `useSyncExternalStore` for tear-free reads.

```typescript
function useContinuumState(
  nodeId: string
): [NodeValue | undefined, (value: NodeValue) => void];
```

### `useContinuumSnapshot()`

Subscribes to the full `ContinuitySnapshot`. Re-renders on every snapshot change.

```typescript
function useContinuumSnapshot(): ContinuitySnapshot | null;
```

### `useContinuumViewport(nodeId)`

Reads and writes per-node viewport context (scroll/zoom/offset/focus metadata).

```typescript
function useContinuumViewport(
  nodeId: string
): [ViewportState | undefined, (state: ViewportState) => void];
```

### `useContinuumDiagnostics()`

Subscribes to reconciliation diagnostics. Re-renders when issues, diffs, resolutions, or checkpoints change.

```typescript
function useContinuumDiagnostics(): {
  issues: ReconciliationIssue[];
  diffs: StateDiff[];
  resolutions: ReconciliationResolution[];
  checkpoints: Checkpoint[];
};
```

### `useContinuumHydrated()`

Returns whether the session was rehydrated from storage on mount.

```typescript
function useContinuumHydrated(): boolean;
```

Throws if used outside a provider.

## Component Map Pattern

Every component in the map receives `ContinuumComponentProps`:

```typescript
interface ContinuumComponentProps<T = NodeValue> {
  value: T | undefined; // current state for this component
  onChange: (value: T) => void; // update state
  definition: ViewNode; // view definition
  children?: React.ReactNode; // rendered children (for containers)
}

type ContinuumComponentMap = Record<
  string,
  ComponentType<ContinuumComponentProps<any>>
>;
```

Example component:

```tsx
function TextInput({ value, onChange, definition }: ContinuumComponentProps) {
  const raw = value as Record<string, unknown> | undefined;
  const textValue = typeof raw?.['value'] === 'string' ? raw['value'] : '';

  return (
    <input
      value={textValue}
      onChange={(e) => onChange({ value: e.target.value })}
      placeholder={definition.key ?? definition.id}
    />
  );
}
```

## Links

- [Root README](../../README.md)
- [Quick Start Guide](../../docs/QUICK_START.md)
