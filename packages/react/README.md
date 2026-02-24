# @continuum/react

React bindings for the Continuum SDK.

Provides a context provider, a schema-driven renderer, and hooks for accessing session state. Handles persistence to localStorage/sessionStorage automatically.

## Installation

```bash
npm install @continuum/react @continuum/contract
```

Peer dependency: `react` >= 19.

## Quick Start

```tsx
import { ContinuumProvider, ContinuumRenderer, useContinuumSession } from '@continuum/react';

const componentMap = {
  input: MyInput,
  select: MySelect,
  toggle: MyToggle,
  default: MyFallback,
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

  useEffect(() => {
    session.pushSchema(schemaFromAgent);
  }, []);

  return snapshot?.schema
    ? <ContinuumRenderer schema={snapshot.schema} />
    : null;
}
```

## Components

### `<ContinuumProvider>`

Wraps your application and manages the Continuum session.

**Props** (`ContinuumProviderProps`):

| Prop | Type | Default | Description |
|---|---|---|---|
| `components` | `ContinuumComponentMap` | required | Map of component type strings to React components |
| `persist` | `'localStorage' \| 'sessionStorage' \| false` | `false` | Where to persist session data |
| `storageKey` | `string` | `'continuum_session'` | Key used in storage |
| `children` | `React.ReactNode` | required | Child elements |

On mount, the provider attempts to rehydrate from storage. If rehydration succeeds, `useContinuumHydrated()` returns `true`. On every snapshot change, the session is automatically serialized back to storage.

### `<ContinuumRenderer>`

Renders a schema by mapping each `ComponentDefinition` to a React component from the component map.

```tsx
<ContinuumRenderer schema={snapshot.schema} />
```

**Props:**

| Prop | Type | Description |
|---|---|---|
| `schema` | `SchemaSnapshot` | The schema to render |

Each component is wrapped in a `<div data-continuum-id={definition.id}>` for identification. Children are rendered recursively. If a component type isn't in the map, falls back to `componentMap['default']`, then to the built-in `FallbackComponent`.

### `<FallbackComponent>`

A built-in component rendered when a type isn't found in the component map. Displays a red dashed border with the unknown type name and an expandable schema definition viewer.

## Hooks

### `useContinuumSession()`

Returns the `Session` object from the nearest `ContinuumProvider`.

```typescript
function useContinuumSession(): Session;
```

Throws if used outside a provider.

### `useContinuumState(componentId)`

Reads and writes a single component's state. Uses `useSyncExternalStore` for tear-free reads.

```typescript
function useContinuumState(
  componentId: string
): [ComponentState | undefined, (value: ComponentState) => void];
```

### `useContinuumSnapshot()`

Subscribes to the full `ContinuitySnapshot`. Re-renders on every snapshot change.

```typescript
function useContinuumSnapshot(): ContinuitySnapshot | null;
```

### `useContinuumDiagnostics()`

Subscribes to reconciliation diagnostics. Re-renders when issues, diffs, trace, or checkpoints change.

```typescript
function useContinuumDiagnostics(): {
  issues: ReconciliationIssue[];
  diffs: StateDiff[];
  trace: ReconciliationTrace[];
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
interface ContinuumComponentProps<T = ComponentState> {
  value: T;                         // current state for this component
  onChange: (value: T) => void;     // update state
  definition: ComponentDefinition;  // schema definition
  children?: React.ReactNode;       // rendered children (for containers)
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

## Internal Exports

### `usePersistence(session, storage, key)`

Hook that subscribes to snapshot changes and persists to the given `Storage` object.

### `ContinuumContext`

The React context. Exported for advanced use cases but not typically used directly.

### `ContinuumContextValue`

```typescript
interface ContinuumContextValue {
  session: Session;
  componentMap: ContinuumComponentMap;
  wasHydrated: boolean;
}
```

## Links

- [Root README](../../README.md)
- [Quick Start Guide](../../docs/QUICK_START.md)
