# CONTINUUM.md -- AI Agent Context File

> This file is optimized for LLM consumption. It describes the Continuum SDK's public API surface, integration patterns, and key constraints so an AI coding assistant can implement against it correctly without reading every source file.

## What Continuum Does

Continuum is a state continuity layer for view-driven UIs. Given a view definition (JSON describing nodes), it:

1. Reconciles user data across view versions (node renamed? state carries. type changed? state detaches.)
2. Persists sessions to storage (survive refresh, survive tab close)
3. Auto-checkpoints on every view push (user can rewind to any prior version)
4. Logs a full audit trail (diffs, resolutions, issues, interactions)

## Core Data Types (`@continuum/contract`)

```typescript
interface ViewDefinition {
  viewId: string;
  version: string;
  nodes: ViewNode[];
}

type ViewNode =
  | FieldNode
  | GroupNode
  | CollectionNode
  | ActionNode
  | PresentationNode;

interface BaseNode {
  id: string;
  type: string;
  key?: string;
  hidden?: boolean;
  hash?: string;
  migrations?: MigrationRule[];
}

interface FieldNode extends BaseNode {
  type: 'field';
  dataType: 'string' | 'number' | 'boolean';
  label?: string;
  placeholder?: string;
  description?: string;
  readOnly?: boolean;
  defaultValue?: unknown;
  constraints?: FieldConstraints;
}

interface GroupNode extends BaseNode {
  type: 'group';
  label?: string;
  children: ViewNode[];
}

interface CollectionNode extends BaseNode {
  type: 'collection';
  label?: string;
  template: ViewNode;
  minItems?: number;
  maxItems?: number;
}

interface ActionNode extends BaseNode {
  type: 'action';
  intentId: string;
  label: string;
  disabled?: boolean;
}

interface PresentationNode extends BaseNode {
  type: 'presentation';
  contentType: 'text' | 'markdown';
  content: string;
}

interface NodeValue<T = unknown> {
  value: T;
  isDirty?: boolean;
  isValid?: boolean;
}

interface DataSnapshot {
  values: Record<string, NodeValue>;
  viewContext?: Record<string, ViewContext>;
  lineage: SnapshotLineage;
  valueLineage?: Record<string, ValueLineage>;
  detachedValues?: Record<string, DetachedValue>;
}

interface ContinuitySnapshot {
  view: ViewDefinition;
  data: DataSnapshot;
}

interface Interaction {
  interactionId: string;
  sessionId: string;
  nodeId: string;
  type: string;
  payload: unknown;
  timestamp: number;
  viewVersion: string;
}

interface PendingIntent {
  intentId: string;
  nodeId: string;
  intentName: string;
  payload: unknown;
  queuedAt: number;
  viewVersion: string;
  status: 'pending' | 'validated' | 'stale' | 'cancelled';
}

interface Checkpoint {
  checkpointId: string;
  sessionId: string;
  snapshot: ContinuitySnapshot;
  eventIndex: number;
  timestamp: number;
  trigger: 'auto' | 'manual';
}
```

## Session API (`@continuum/session`)

```typescript
import { createSession, deserialize } from '@continuum/session';

const session = createSession();                   // or createSession({ clock: Date.now })
const restored = deserialize(blob);                // reconstruct from session.serialize() output

// Push a new view definition -- triggers reconciliation, auto-checkpoints
session.pushView(view);

// Read current state
session.getSnapshot();        // ContinuitySnapshot | null
session.getIssues();          // ReconciliationIssue[]
session.getDiffs();           // StateDiff[]
session.getResolutions();     // ReconciliationResolution[]
session.getEventLog();        // Interaction[]
session.getDetachedValues();  // Record<string, DetachedValue>

// Update node state (user interaction)
session.updateState('nodeId', { value: 'hello' });

// Record a custom interaction event
session.recordIntent({ nodeId: 'name', type: 'value-change', payload: { value: 'Alice' } });

// Pending intents
session.submitIntent({ nodeId: 'form', intentName: 'submit', payload: {} });
session.getPendingIntents();         // PendingIntent[]
session.validateIntent(intentId);    // boolean
session.cancelIntent(intentId);      // boolean

// Checkpoint & Rewind
session.checkpoint();                // manually create a checkpoint (trigger: "manual")
session.restoreFromCheckpoint(cp);   // restore from a checkpoint object
session.getCheckpoints();            // Checkpoint[]
session.rewind(checkpointId);        // restores to that checkpoint, trims stack
session.reset();                     // reset to empty session state

// Persistence
const blob = session.serialize();    // { formatVersion: 1, ...full state }

// Listeners (return unsubscribe functions)
const unsub1 = session.onSnapshot((snapshot) => {});  // receives ContinuitySnapshot
const unsub2 = session.onIssues(callback);    // fires after pushView, rewind

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
  components={nodeMap}            // Record<string, React.ComponentType>
  persist="localStorage"          // "localStorage" | "sessionStorage" | false
  storageKey="continuum_session"  // optional custom key
>
  <App />
</ContinuumProvider>

// Access the session inside the provider
const session = useContinuumSession();

// Render a view definition
<ContinuumRenderer view={snapshot.view} />

// Read/write a single node's state (uses useSyncExternalStore)
const [value, setValue] = useContinuumState('nodeId');

// Subscribe to the full snapshot (re-renders on every change)
const snapshot = useContinuumSnapshot();   // ContinuitySnapshot | null

// Subscribe to diagnostics (re-renders on view push or issue change)
const { issues, diffs, resolutions, checkpoints } = useContinuumDiagnostics();

// Check if the session was rehydrated from storage
const wasHydrated = useContinuumHydrated();  // boolean
```

## Angular Integration (`@continuum/angular`)

```typescript
import {
  provideContinuum,
  injectContinuumSession,
  ContinuumRendererComponent,
} from '@continuum/angular';
import type { ContinuumNodeProps, ContinuumNodeMap } from '@continuum/angular';

// Provide in your app config
bootstrapApplication(AppComponent, {
  providers: [
    provideContinuum({
      components: nodeMap,          // ContinuumNodeMap
      persist: 'localStorage',
    }),
  ],
});

// Inject the session in any component
const session = injectContinuumSession();

// Render a view definition in a template
// <continuum-renderer [view]="snapshot.view" />
```

## Protocol Adapters (`@continuum/adapters`)

Transform external UI formats into Continuum's `ViewDefinition`:

```typescript
import { a2uiAdapter } from '@continuum/adapters';
import type { ProtocolAdapter, A2UIForm } from '@continuum/adapters';

// Convert A2UI JSON → ViewDefinition
const view = a2uiAdapter.toView(a2uiForm);

// Convert external data → Continuum state (Record<string, NodeValue>)
const state = a2uiAdapter.toState({ name: 'Alice', agree: true });

// Convert back
const form = a2uiAdapter.fromView(view);
const data = a2uiAdapter.fromState(state);
```

The `ProtocolAdapter` interface:

```typescript
interface ProtocolAdapter<TExternalView, TExternalData = unknown> {
  name: string;
  toView(external: TExternalView): ViewDefinition;
  fromView?(definition: ViewDefinition): TExternalView;
  toState?(externalData: TExternalData): Record<string, NodeValue>;
  fromState?(state: Record<string, NodeValue>): TExternalData;
}
```

A2UI type mapping: `TextInput` → `field` with dataType `'string'`, `TextArea` → `field` with dataType `'string'`, `Dropdown`/`SelectionInput` → `field` with dataType `'string'`, `Switch`/`Toggle` → `field` with dataType `'boolean'`, `DateInput` → `field` with dataType `'string'`, `Section`/`Card` → `group`.

## Node Map

Components are React components receiving `ContinuumNodeProps`:

```typescript
interface ContinuumNodeProps<T = NodeValue> {
  value: T | undefined;
  onChange: (value: T) => void;
  definition: ViewNode;
  children?: React.ReactNode;
  [prop: string]: unknown;
}
```

Register them by node type string:

```typescript
const nodeMap = {
  field: TextField,
  group: SectionLayout,
  collection: RepeaterLayout,
  action: ActionButton,
  presentation: DisplayContent,
  default: FallbackComponent,
};
```

## Reconciliation Rules

When `pushView(newView)` is called with existing data:

1. **Match by ID** -- if a node in the new view has the same `id` as one in the prior view, they match
2. **Match by key** -- if IDs differ but `key` matches, the node is treated as renamed
3. **Type check** -- if matched nodes have different `type`, state is **detached** (TYPE_MISMATCH)
4. **Hash check** -- if matched nodes have different `hash`, look for a migration rule
5. **Migration** -- try `migrationStrategies[nodeId]`, then `MigrationRule.strategyId` via `strategyRegistry`
6. **Fallback carry** -- if migration lookup is absent and type still matches, prior state carries forward
7. **New nodes** -- nodes in new view with no match are added with empty state
8. **Removed nodes** -- nodes in prior view with no match in new view are logged as removed

## Constants (`@continuum/contract`)

```typescript
import { ISSUE_CODES, DATA_RESOLUTIONS, VIEW_DIFFS, ISSUE_SEVERITY, INTENT_STATUS } from '@continuum/contract';

ISSUE_CODES.TYPE_MISMATCH       // 'TYPE_MISMATCH'
ISSUE_CODES.NODE_REMOVED        // 'NODE_REMOVED'
ISSUE_CODES.UNKNOWN_NODE        // 'UNKNOWN_NODE'
ISSUE_CODES.NO_PRIOR_DATA       // 'NO_PRIOR_DATA'
ISSUE_CODES.NO_PRIOR_VIEW       // 'NO_PRIOR_VIEW'
ISSUE_CODES.UNVALIDATED_CARRY   // 'UNVALIDATED_CARRY'
ISSUE_CODES.MIGRATION_FAILED    // 'MIGRATION_FAILED'
ISSUE_CODES.VALIDATION_FAILED   // 'VALIDATION_FAILED'

DATA_RESOLUTIONS.CARRIED        // 'carried'
DATA_RESOLUTIONS.DETACHED       // 'detached'
DATA_RESOLUTIONS.MIGRATED       // 'migrated'
DATA_RESOLUTIONS.ADDED          // 'added'
DATA_RESOLUTIONS.RESTORED       // 'restored'

VIEW_DIFFS.ADDED                // 'added'
VIEW_DIFFS.REMOVED              // 'removed'
VIEW_DIFFS.MIGRATED             // 'migrated'
VIEW_DIFFS.TYPE_CHANGED         // 'type-changed'
VIEW_DIFFS.RESTORED             // 'restored'

INTENT_STATUS.PENDING           // 'pending'
INTENT_STATUS.VALIDATED         // 'validated'
INTENT_STATUS.STALE             // 'stale'
INTENT_STATUS.CANCELLED         // 'cancelled'
```

## Key Constraints

- `ViewDefinition.viewId` is the field name (not `id`)
- `session.serialize()` output includes `formatVersion: 1`
- `deserialize()` only accepts `formatVersion: 1`; any other value (including missing) throws an error
- `pushView` auto-creates a checkpoint after reconciliation
- `rewind(checkpointId)` trims the checkpoint stack to the rewound point (cannot re-rewind past it)
- The session is stateful and single-threaded -- do not call methods concurrently
- Node state shape is `NodeValue<T>` (`{ value: T, isDirty?, isValid? }`); the session does not validate it beyond structure

## Project Structure

```
packages/contract/   - Types, interfaces, constants (ViewDefinition, DataSnapshot, NodeValue)
packages/runtime/    - Reconciliation engine (reconcile function)
packages/session/    - Session lifecycle (createSession, deserialize)
packages/react/      - React bindings (Provider, Renderer, hooks)
packages/angular/    - Angular bindings (provideContinuum, signals, standalone renderer, forms)
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
