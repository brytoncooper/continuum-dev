# CONTINUUM.md -- AI Agent Context File

> This file is optimized for LLM consumption. It describes the Continuum SDK's public API surface, integration patterns, and key constraints so an AI coding assistant can implement against it correctly without reading every source file.

## What Continuum Does

Continuum is a state continuity layer for schema-driven UIs. Given a UI schema (JSON describing components), it:

1. Reconciles user state across schema versions (component renamed? state carries. type changed? state drops.)
2. Persists sessions to storage (survive refresh, survive tab close)
3. Auto-checkpoints on every schema push (user can rewind to any prior version)
4. Logs a full audit trail (diffs, traces, issues, interactions)

## Core Data Types (`@continuum/contract`)

```typescript
interface SchemaSnapshot {
  schemaId: string;
  version: string;
  components: ComponentDefinition[];
}

interface ComponentDefinition {
  id: string;
  type: string;
  key?: string;        // stable identifier for matching across schema versions
  path?: string;       // display label or hierarchical path
  hash?: string;       // schema shape hash for migration detection
  stateType?: string;  // hint about the expected state shape
  stateShape?: unknown; // metadata (e.g. dropdown options as { id, label }[])
  migrations?: MigrationRule[];
  children?: ComponentDefinition[];
}

interface Interaction {
  id: string;
  sessionId: string;
  componentId: string;
  type: string;
  payload: unknown;
  timestamp: number;
  schemaVersion: string;
}

interface PendingAction {
  id: string;
  componentId: string;
  actionType: string;
  payload: unknown;
  createdAt: number;
  schemaVersion: string;
  status: 'pending' | 'validated' | 'stale' | 'cancelled';
}

interface StateSnapshot {
  values: Record<string, ComponentState>;  // componentId -> state
  meta: StateMeta;
  valuesMeta?: Record<string, ValueMeta>;
}

interface ContinuitySnapshot {
  schema: SchemaSnapshot;
  state: StateSnapshot;
}

interface Checkpoint {
  id: string;
  sessionId: string;
  snapshot: ContinuitySnapshot;
  eventIndex: number;
  timestamp: number;
}
```

## Session API (`@continuum/session`)

```typescript
import { createSession, deserialize } from '@continuum/session';

const session = createSession();                   // or createSession({ clock: Date.now })
const restored = deserialize(blob);                // reconstruct from session.serialize() output

// Push a new schema -- triggers reconciliation, auto-checkpoints
session.pushSchema(schema);

// Read current state
session.getSnapshot();    // ContinuitySnapshot | null
session.getIssues();      // ReconciliationIssue[]
session.getDiffs();       // StateDiff[]
session.getTrace();       // ReconciliationTrace[]
session.getEventLog();    // Interaction[]

// Update component state (user interaction)
session.updateState('componentId', { value: 'hello' });

// Record a custom interaction event
session.recordIntent({ componentId: 'name', type: 'value-change', payload: { value: 'Alice' } });

// Pending actions
session.submitAction({ componentId: 'form', actionType: 'submit', payload: {} });
session.getPendingActions();         // PendingAction[]
session.validateAction(actionId);    // mark as validated
session.cancelAction(actionId);      // mark as cancelled

// Checkpoint & Rewind
session.checkpoint();                // manually create a checkpoint
session.getCheckpoints();            // Checkpoint[]
session.rewind(checkpointId);        // restores to that checkpoint, trims stack

// Persistence
const blob = session.serialize();    // { formatVersion: 1, ...full state }

// Listeners (return unsubscribe functions)
const unsub1 = session.onSnapshot(callback);  // fires after pushSchema, updateState, rewind
const unsub2 = session.onIssues(callback);    // fires after pushSchema, rewind

// Lifecycle
session.destroy();  // teardown, returns { issues }
```

## React Integration (`@continuum/react`)

```tsx
import {
  ContinuumProvider,
  ContinuumRenderer,
  useContinuumSession,
  useContinuumState,
  useContinuumSnapshot,
  useContinuumDiagnostics,
  useContinuumHydrated,
} from '@continuum/react';

// Provider wraps your app, handles persistence
<ContinuumProvider
  components={componentMap}     // Record<string, React.ComponentType>
  persist="localStorage"        // "localStorage" | "sessionStorage" | false
  storageKey="continuum_session" // optional custom key
>
  <App />
</ContinuumProvider>

// Access the session inside the provider
const session = useContinuumSession();

// Render a schema
<ContinuumRenderer schema={snapshot.schema} />

// Read/write a single component's state (uses useSyncExternalStore)
const [value, setValue] = useContinuumState('componentId');

// Subscribe to the full snapshot (re-renders on every change)
const snapshot = useContinuumSnapshot();   // ContinuitySnapshot | null

// Subscribe to diagnostics (re-renders on schema push or issue change)
const { issues, diffs, trace, checkpoints } = useContinuumDiagnostics();

// Check if the session was rehydrated from storage
const wasHydrated = useContinuumHydrated();  // boolean
```

## Protocol Adapters (`@continuum/adapters`)

Transform external UI schema formats into Continuum's `SchemaSnapshot`:

```typescript
import { a2uiAdapter } from '@continuum/adapters';
import type { ProtocolAdapter, A2UIForm } from '@continuum/adapters';

// Convert A2UI JSON → SchemaSnapshot
const schema = a2uiAdapter.toSchema(a2uiForm);

// Convert external data → Continuum state
const state = a2uiAdapter.toState({ name: 'Alice', agree: true });

// Convert back
const form = a2uiAdapter.fromSchema(schema);
const data = a2uiAdapter.fromState(state);
```

The `ProtocolAdapter` interface:

```typescript
interface ProtocolAdapter<TExternalSchema, TExternalData = unknown> {
  name: string;
  toSchema(external: TExternalSchema): SchemaSnapshot;
  fromSchema?(snapshot: SchemaSnapshot): TExternalSchema;
  toState?(externalData: TExternalData): Record<string, ComponentState>;
  fromState?(state: Record<string, ComponentState>): TExternalData;
}
```

A2UI type mapping: `TextInput` → `input`, `TextArea` → `textarea`, `Dropdown`/`SelectionInput` → `select`, `Switch`/`Toggle` → `toggle`, `DateInput` → `date`, `Section`/`Card` → `container`.

## Component Map

Components are React components receiving `ContinuumComponentProps`:

```typescript
interface ContinuumComponentProps {
  value: ComponentState | undefined;
  onChange: (state: ComponentState) => void;
  definition: ComponentDefinition;
  children?: React.ReactNode;
}
```

Register them by type string:

```typescript
const componentMap = {
  input: TextInput,
  select: SelectField,
  toggle: ToggleSwitch,
  date: DateInput,
  textarea: TextArea,
  'radio-group': RadioGroup,
  slider: Slider,
  section: Section,
  container: ContainerLayout,
  default: FallbackComponent,
};
```

## Reconciliation Rules

When `pushSchema(newSchema)` is called with existing state:

1. **Match by ID** -- if a component in the new schema has the same `id` as one in the prior schema, they match
2. **Match by key** -- if IDs differ but `key` matches, the component is treated as renamed
3. **Type check** -- if matched components have different `type`, state is **dropped** (TYPE_MISMATCH)
4. **Hash check** -- if matched components have different `hash`, look for a migration rule
5. **Migration** -- if a `MigrationRule` exists for the hash transition, apply the registered strategy
6. **Carry** -- if type and hash match, state carries forward unchanged
7. **New components** -- components in new schema with no match are added with empty state
8. **Removed components** -- components in prior schema with no match in new schema are logged as removed

## Constants (`@continuum/contract`)

```typescript
import { ISSUE_CODES, TRACE_ACTIONS, DIFF_TYPES, ISSUE_SEVERITY, ACTION_STATUS } from '@continuum/contract';

ISSUE_CODES.TYPE_MISMATCH    // 'TYPE_MISMATCH'
ISSUE_CODES.COMPONENT_REMOVED // 'COMPONENT_REMOVED'
TRACE_ACTIONS.CARRIED         // 'carried'
TRACE_ACTIONS.DROPPED         // 'dropped'
DIFF_TYPES.ADDED              // 'added'
```

## Key Constraints

- `SchemaSnapshot.schemaId` is the field name (not `id`)
- `session.serialize()` output includes `formatVersion: 1` -- deserialize validates this
- `deserialize()` accepts blobs without `formatVersion` (legacy support) but rejects `formatVersion > 1`
- `pushSchema` auto-creates a checkpoint after reconciliation
- `rewind(id)` trims the checkpoint stack to the rewound point (cannot re-rewind past it)
- The session is stateful and single-threaded -- do not call methods concurrently
- Component state shape is opaque (`ComponentState = Record<string, unknown> | ...`); the session does not validate it

## Project Structure

```
packages/contract/   - Types, interfaces, constants
packages/runtime/    - Reconciliation engine (reconcile function)
packages/session/    - Session lifecycle (createSession, deserialize)
packages/react/      - React bindings (Provider, Renderer, hooks)
packages/adapters/   - Protocol adapters (ProtocolAdapter interface, A2UI adapter)
apps/playground/     - Demo application (protocol toggle, hallucination animations)
```

## Testing

All code uses Vitest. Tests are co-located (`*.spec.ts`). Run with:
```bash
npx nx run @continuum/adapters:test
npx nx run @continuum/session:test
npx nx run runtime:test
npx nx run-many -t test
```
