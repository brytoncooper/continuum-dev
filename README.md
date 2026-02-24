# Continuum

**Protocol-agnostic state continuity for schema-driven UIs.**

Continuum is the runtime layer that preserves user state when dynamic UIs change. Whether an AI agent regenerates your interface, a schema update reorganizes your form, or a user refreshes the page -- their data stays intact.

## Why Continuum

Schema-driven UIs are fragile. An AI generates a form, the user fills it out, the AI regenerates -- and everything the user typed is gone. Continuum solves this with deterministic reconciliation: match components across schema versions, carry state forward, migrate when shapes change, and log what happened.

**For AI developers:** Your agent generates UI schemas. Continuum handles the state lifecycle -- persistence, reconciliation, rewind, and audit trail -- so your agent can focus on generating, not bookkeeping.

**For app developers:** Drop-in persistent, rewindable state for any React app. When you add AI later, your app is already wired for it.

## Packages

| Package | Description |
|---|---|
| `@continuum/contract` | Core types and constants -- SchemaSnapshot, StateSnapshot, Checkpoint |
| `@continuum/runtime` | Reconciliation engine -- diffs schemas, carries state, logs traces |
| `@continuum/session` | Session manager -- orchestrates pushSchema, updateState, checkpoint, rewind, serialize |
| `@continuum/react` | React bindings -- Provider, Renderer, hooks |
| `@continuum/adapters` | Protocol adapters -- transform external formats (A2UI) into SchemaSnapshot |

## Quick Start

```bash
npm install @continuum/react @continuum/contract
```

```tsx
import { ContinuumProvider, ContinuumRenderer, useContinuumSession } from '@continuum/react';
import type { SchemaSnapshot } from '@continuum/contract';

const componentMap = {
  input: MyInputComponent,
  toggle: MyToggleComponent,
  select: MySelectComponent,
};

function App() {
  return (
    <ContinuumProvider components={componentMap} persist="localStorage">
      <YourApp />
    </ContinuumProvider>
  );
}

function YourApp() {
  const session = useContinuumSession();

  function handleSchemaFromAgent(schema: SchemaSnapshot) {
    session.pushSchema(schema);
  }

  const snapshot = session.getSnapshot();

  return snapshot ? (
    <ContinuumRenderer schema={snapshot.schema} />
  ) : null;
}
```

State is automatically reconciled on each `pushSchema`. User input is preserved across schema changes when components match by key or ID. Sessions persist to localStorage and survive refresh.

## Key Features

**Reconciliation** -- Deterministic algorithm that matches components across schema versions by ID, key, and type. Carries forward state for matches, drops for type mismatches, and supports custom migration strategies.

**Auto-Checkpoint & Rewind** -- Every `pushSchema` creates a checkpoint. Call `session.getCheckpoints()` to see the timeline and `session.rewind(id)` to restore any prior version instantly.

**Serialization** -- `session.serialize()` produces a versioned JSON blob containing the full session state, schema, event log, and checkpoints. `deserialize()` reconstructs a working session. Format-versioned for forward compatibility.

**Persistence** -- The React provider handles localStorage/sessionStorage persistence automatically. Sessions rehydrate on page load with full state intact.

**Audit Trail** -- Every schema push generates a reconciliation trace (what was carried, migrated, dropped, added) and diffs. Every user interaction is logged with timestamps.

## Development

```bash
npx nx run-many -t test        # Run all tests
npx nx run-many -t build       # Build all packages
npx nx run playground:dev      # Run the playground demo
npx nx run playground:e2e      # Run e2e tests
```

## Architecture

```
@continuum/contract    (types, constants)
       ↓
@continuum/runtime     (reconciliation engine)
       ↓
@continuum/session     (session lifecycle)
       ↓
@continuum/react       (React bindings)
       ↓
apps/playground        (demo application)

@continuum/adapters    (protocol adapters, depends on contract)
```

## Documentation

| Guide | Description |
|---|---|
| [Quick Start](docs/QUICK_START.md) | 5-minute integration guide with copy-paste code |
| [Integration Guide](docs/INTEGRATION_GUIDE.md) | Server-sent schemas, custom migrations, protocol adapters, persistence, lifecycle |
| [Schema Contract](docs/SCHEMA_CONTRACT.md) | Definitive reference for SchemaSnapshot format and reconciliation rules |
| [AI Integration](docs/AI_INTEGRATION.md) | Connecting an AI agent to Continuum with prompt templates and examples |

See [docs/](docs/README.md) for the full documentation index -- product vision, architecture, current gaps, and the phase roadmap.

## License

MIT
