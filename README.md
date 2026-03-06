# Continuum

**Protocol-agnostic state continuity for view-driven UIs.**

> [!WARNING] > **Pre-release Note**: Continuum is currently in active development. The APIs, package exports, and installation processes described below are subject to change.

Continuum is the runtime layer that preserves user state when dynamic UIs change. Whether an AI agent regenerates your interface, a view update reorganizes your form, or a user refreshes the page -- their data stays intact.

## Why Continuum

View-driven UIs are fragile. An AI generates a form, the user fills it out, the AI regenerates -- and everything the user typed is gone. Continuum solves this with deterministic reconciliation: match nodes across view versions, carry state forward, migrate when shapes change, and log what happened.

**For AI developers:** Your agent generates view definitions. Continuum handles the data lifecycle -- persistence, reconciliation, rewind, and audit trail -- so your agent can focus on generating, not bookkeeping.

**For app developers:** Drop-in persistent, rewindable state for React apps. When you add AI later, your app is already wired for it.

## Packages

| Package                   | Description                                                                          | Status |
| ------------------------- | ------------------------------------------------------------------------------------ | ------ |
| `@continuum-dev/contract` | Core types and constants -- ViewDefinition, DataSnapshot, NodeValue, Checkpoint     | Published |
| `@continuum-dev/runtime`  | Reconciliation engine -- diffs views, carries state, logs resolutions               | Published |
| `@continuum-dev/session`  | Session manager -- orchestrates pushView, updateState, checkpoint, rewind, serialize | Published |
| `@continuum-dev/react`    | React bindings -- Provider, Renderer, hooks                                          | Published |
| `@continuum-dev/prompts`  | Prompt templates and composition helpers for AI view generation                      | Ready to publish |
| `@continuum-dev/angular`  | Angular bindings -- provideContinuum, signals, standalone renderer, forms            | Not published (internal preview) |
| `@continuum-dev/adapters` | Protocol adapters -- transform external formats (A2UI) into ViewDefinition           | Not published (internal preview) |

## Quick Start

```bash
npm install @continuum-dev/react @continuum-dev/contract
```

```tsx
import {
  ContinuumProvider,
  ContinuumRenderer,
  useContinuumSession,
} from '@continuum-dev/react';
import type { ContinuumNodeMap } from '@continuum-dev/react';
import type { ViewDefinition } from '@continuum-dev/contract';

const nodeMap: ContinuumNodeMap = {
  field: MyFieldComponent,
  group: MySectionComponent,
  action: MyActionButton,
  presentation: MyDisplayContent,
};

function App() {
  return (
    <ContinuumProvider components={nodeMap} persist="localStorage">
      <YourApp />
    </ContinuumProvider>
  );
}

function YourApp() {
  const session = useContinuumSession();

  function handleViewFromAgent(view: ViewDefinition) {
    session.pushView(view);
  }

  const snapshot = session.getSnapshot();

  return snapshot ? <ContinuumRenderer view={snapshot.view} /> : null;
}
```

State is automatically reconciled on each `pushView`. User input is preserved across view changes when nodes match by key or ID. Sessions persist to localStorage and survive refresh.

## Key Features

**Reconciliation** -- Deterministic algorithm that matches nodes across view versions by ID, key, and type. Carries forward state for matches, detaches for type mismatches, and supports custom migration strategies.

**Auto-Checkpoint & Rewind** -- Every `pushView` creates a checkpoint. Call `session.getCheckpoints()` to see the timeline and `session.rewind(checkpointId)` to restore any prior version instantly.

**Serialization** -- `session.serialize()` produces a versioned JSON blob containing the full session state, view, event log, and checkpoints. `deserialize()` reconstructs a working session. Format-versioned for forward compatibility.

**Persistence** -- The React provider handles localStorage/sessionStorage persistence automatically. Sessions rehydrate on page load with full state intact.

**Audit Trail** -- Every view push generates reconciliation resolutions (what was carried, migrated, detached, added) and diffs. Every user interaction is logged with timestamps.

## Session API Highlights

The session surface in `@continuum-dev/session` includes:

- Core reads: `getSnapshot`, `getIssues`, `getDiffs`, `getResolutions`, `getEventLog`, `getDetachedValues`
- Mutations: `pushView`, `updateState`, `recordIntent`
- Intent lifecycle: `submitIntent`, `getPendingIntents`, `validateIntent`, `cancelIntent`
- Time travel: `checkpoint`, `restoreFromCheckpoint`, `getCheckpoints`, `rewind`, `reset`
- Persistence and subscriptions: `serialize`, `onSnapshot`, `onIssues`, `destroy`

Serialized payloads use `formatVersion: 1`; deserialization accepts `formatVersion: 1` and also accepts blobs without `formatVersion` for compatibility.

## Development

```bash
npx nx run-many -t test        # Run all tests
npx nx run-many -t build       # Build all packages
npx nx run playground:serve    # Run the playground demo
npx nx run playground:e2e      # Run e2e tests
```

## Architecture

```
@continuum-dev/contract    (types, constants)
       ↓
@continuum-dev/runtime     (reconciliation engine)
       ↓
@continuum-dev/session     (session lifecycle)
       ↓
@continuum-dev/react       (React bindings)
@continuum-dev/prompts     (AI prompt templates)
apps/playground        (demo application)

@continuum-dev/angular     (internal preview, not published)
@continuum-dev/adapters    (internal preview, not published)
```

## Documentation

| Guide                                          | Description                                                                     |
| ---------------------------------------------- | ------------------------------------------------------------------------------- |
| [Quick Start](docs/QUICK_START.md)             | 5-minute integration guide with copy-paste code                                 |
| [Integration Guide](docs/INTEGRATION_GUIDE.md) | Server-sent views, custom migrations, protocol adapters, persistence, lifecycle |
| [View Contract Reference](docs/VIEW_CONTRACT.md) | Definitive reference for ViewDefinition format and reconciliation rules      |
| [AI Integration](docs/AI_INTEGRATION.md)       | Connecting an AI agent to Continuum with prompt templates and examples          |

## License

MIT
