# Continuum

**State continuity for view-driven and AI-generated UIs.**

Website: [continuumstack.dev](https://continuumstack.dev)  
GitHub: [brytoncooper/continuum-dev](https://github.com/brytoncooper/continuum-dev)

Continuum keeps UI structure and user state separate, then reconciles them deterministically as views change.

That means:

- an AI can regenerate a form without wiping what the user already entered
- a backend can send a new screen layout without losing meaningful state
- a user can refresh, rewind, and continue from the same session

> [!WARNING]
> Continuum is pre-release. The package surfaces are usable, but APIs and docs may continue to evolve quickly.

## Why this exists

Modern apps increasingly treat UI as generated output:

- AI models generate and revise forms
- server-driven flows send new view definitions
- product teams iterate on structure faster than persistence layers can keep up

The hard part is not rendering the next view. The hard part is preserving user intent when that view changes.

Continuum solves that with a few core ideas:

- `ViewDefinition` describes the current UI
- session state is stored separately from the rendered structure
- `pushView(view)` reconciles the old and new trees
- matching nodes carry state forward by `id`, `key`, and type
- mismatches, migrations, detachments, and restores are recorded for inspection

## Start here

If you want the fastest path, use the starter kit:

```bash
npm install @continuum-dev/starter-kit react
```

```tsx
import { useEffect } from 'react';
import {
  ContinuumProvider,
  ContinuumRenderer,
  starterKitComponentMap,
  useContinuumSession,
  useContinuumSnapshot,
  type ViewDefinition,
} from '@continuum-dev/starter-kit';

const initialView: ViewDefinition = {
  viewId: 'profile-form',
  version: '1',
  nodes: [
    {
      id: 'profile',
      type: 'group',
      key: 'profile',
      label: 'Profile',
      children: [
        {
          id: 'name',
          type: 'field',
          dataType: 'string',
          key: 'name',
          label: 'Name',
        },
        {
          id: 'email',
          type: 'field',
          dataType: 'string',
          key: 'email',
          label: 'Email',
        },
      ],
    },
  ],
};

function Page() {
  const session = useContinuumSession();
  const snapshot = useContinuumSnapshot();

  useEffect(() => {
    if (!snapshot) {
      session.pushView(initialView);
    }
  }, [session, snapshot]);

  if (!snapshot?.view) {
    return null;
  }

  return <ContinuumRenderer view={snapshot.view} />;
}

export function App() {
  return (
    <ContinuumProvider components={starterKitComponentMap} persist="localStorage">
      <Page />
    </ContinuumProvider>
  );
}
```

Once the initial view is mounted, you can push a new version at any time:

```tsx
session.pushView(nextViewFromServerOrAgent);
```

Continuum will preserve matching data automatically and record what changed.

## Choose your package

### `@continuum-dev/starter-kit`

Use this if you want the easiest React setup.

It gives you:

- ready-to-use primitives
- a default component map
- proposal-aware UI helpers
- session workbench and provider chat primitives
- re-exports for the most common Continuum APIs

### `@continuum-dev/react`

Use this if you want Continuum’s React state model but your own rendering layer.

### `@continuum-dev/core`

Use this if you want the session/runtime facade without the React primitives.

### `@continuum-dev/session` and `@continuum-dev/runtime`

Use these directly if you need lower-level control over reconciliation and session behavior.

## What Continuum gives you

### Reconciliation

When a new view arrives, Continuum tries to match new nodes to prior nodes:

- first by scoped `id`
- then by semantic `key`
- then by detached values when restoration is possible

If types match, values carry forward. If shapes changed and a migration is configured, values can be transformed. If continuity breaks, the old value is detached instead of silently corrupted.

### Checkpoints and rewind

Every `pushView` creates an auto-checkpoint. You can inspect the timeline, restore a previous checkpoint, or rewind the session to an earlier state.

### Persistence

The React provider supports built-in `localStorage` and `sessionStorage` persistence with automatic rehydration.

### Diagnostics

Every push produces:

- issues
- diffs
- resolutions
- event history

That gives you an audit trail for what happened to user state during each view change.

### Actions and intents

Action nodes trigger registered handlers by `intentId`. Handlers receive the current snapshot plus a session reference, so they can read or mutate state as part of the action lifecycle.

## Package map

| Package | What it is | Status |
| --- | --- | --- |
| `@continuum-dev/contract` | Core types and constants such as `ViewDefinition`, `DataSnapshot`, and checkpoints | Published |
| `@continuum-dev/runtime` | Stateless reconciliation engine | Published |
| `@continuum-dev/session` | Stateful session lifecycle, persistence, checkpoints, rewind, proposals, and actions | Published |
| `@continuum-dev/core` | Thin facade over contract, runtime, and session | New |
| `@continuum-dev/react` | Headless React bindings | Published |
| `@continuum-dev/starter-kit` | Opinionated React primitives, default component map, proposal UI, and AI helpers | New |
| `@continuum-dev/prompts` | Prompt composition helpers for create/evolve/correction flows | Ready to publish |
| `@continuum-dev/ai-connect` | Headless provider clients and model catalog helpers | Published |
| `@continuum-dev/angular` | Angular bindings | Internal preview |
| `@continuum-dev/adapters` | Protocol adapters for external formats | Internal preview |

## Recommended reading path

If you are new:

1. [Quick Start](docs/QUICK_START.md)
2. [Starter Kit README](packages/starter-kit/README.md)
3. [Integration Guide](docs/INTEGRATION_GUIDE.md)

If you are wiring AI:

1. [AI Integration Guide](docs/AI_INTEGRATION.md)
2. [View Contract Reference](docs/VIEW_CONTRACT.md)

If you need exact contract details:

1. [View Contract Reference](docs/VIEW_CONTRACT.md)

## Architecture

```text
@continuum-dev/contract
        ↓
@continuum-dev/runtime
        ↓
@continuum-dev/session
        ↓
@continuum-dev/core
        ↓
@continuum-dev/react
        ↓
@continuum-dev/starter-kit

@continuum-dev/prompts
@continuum-dev/ai-connect

apps/demo
apps/demo-api
```

The published package stack is layered. The starter kit sits at the top as the easiest public entry point.
The demo surface is now split on purpose:

- `apps/demo`: frontend SPA and Continuum client runtime
- `apps/demo-api`: Cloudflare Worker and `/api/*` routes

## Development

```bash
npx nx run-many -t build
npx nx run-many -t test
npx nx run demo:serve
npx nx run demo-api:dev
npx nx run demo:build
```

## License

MIT
