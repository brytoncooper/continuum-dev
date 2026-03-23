# Continuum

**State continuity for view-driven and AI-generated UIs.**

Website: [continuumstack.dev](https://continuumstack.dev)  
GitHub: [brytoncooper/continuum-dev](https://github.com/brytoncooper/continuum-dev)

Continuum keeps UI structure and user intent separate, then reconciles them deterministically as views change.

That means:

- an AI can regenerate a form without wiping what the user already entered
- a server can send a new screen layout without losing meaningful state
- a user can refresh, rewind, and continue from the same session

> [!WARNING]
> Continuum is pre-release. The package surfaces are usable, but APIs and docs may continue to evolve quickly.

## Upgrading from 0.3.x

If you are upgrading an existing Continuum integration, start here:

- [Upgrade Guide](docs/UPGRADING_FROM_0.3.x_TO_NEXT.md)
- [API Delta](docs/API_DELTA_0.3.x_TO_NEXT.md)
- [Starter Kit AI Migration Guide](docs/STARTER_KIT_AI_MIGRATION.md)
- [Session Streaming Guide](packages/session/STREAMING.md)

## Why this exists

Modern apps increasingly treat UI as generated output:

- AI models generate and revise forms
- server-driven flows send new view definitions
- product teams iterate on structure faster than persistence layers can keep up

The hard part is not rendering the next view. The hard part is preserving user intent when that view changes.

Continuum solves that with a few core ideas:

- `ViewDefinition` describes the current UI
- session state is stored separately from rendered structure
- `pushView(view)` reconciles old and new trees
- matching nodes carry state forward by `id`, `semanticKey`, and compatible shape
- mismatches, migrations, detachments, and restore reviews are recorded for inspection

## Start here

If you want the fastest path to a rendered app, start with the slim starter kit:

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
    <ContinuumProvider
      components={starterKitComponentMap}
      persist="localStorage"
    >
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

## Choose your lane

### 1. Rendering only

Use this when you want the smallest public surface for a React app.

- `@continuum-dev/starter-kit` for the preset component map, styles, primitives, hooks, and `StarterKitSessionWorkbench`
- `@continuum-dev/react` if you want Continuum's React state model but your own rendering layer

### 2. Starter AI facade

Use this when you want the easiest path for teams already using hosted AI providers or Vercel transports.

```bash
npm install @continuum-dev/starter-kit-ai react
```

- `@continuum-dev/starter-kit-ai` is the stable facade package for the starter AI lane
- underneath it composes `starter-kit`, `ai-connect`, `ai-engine`, and `vercel-ai-sdk-adapter`
- if you outgrow the facade, those lower-level packages stay available directly

### 3. Headless AI facade

Use this when you want to keep full control over UI and orchestration.

```bash
npm install @continuum-dev/ai-core react
```

- `@continuum-dev/ai-core` is the stable facade package for the raw continuity plus transport lane
- underneath it re-exports `react`, `core`, `session`, `ai-connect`, `ai-engine`, and `vercel-ai-sdk-adapter`
- if you want explicit package-by-package control, those lower-level packages still stay available directly

## What Continuum gives you

### Reconciliation

When a new view arrives, Continuum tries to match new nodes to prior nodes:

- first by scoped `id`
- then by semantic continuity metadata
- then by detached values when restoration is possible

If shapes still match, values carry forward. If shapes changed and a migration is configured, values can be transformed. If continuity breaks, the old value is detached instead of silently corrupted.

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

| Package                                | What it is                                                                                               | Status    |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------- | --------- |
| `@continuum-dev/contract`              | Core types and constants such as `ViewDefinition`, `DataSnapshot`, and checkpoints                       | Published |
| `@continuum-dev/runtime`               | Stateless reconciliation engine                                                                          | Published |
| `@continuum-dev/session`               | Stateful session lifecycle, persistence, checkpoints, rewind, proposals, restore review, and streaming   | Published |
| `@continuum-dev/core`                  | Thin facade over contract, runtime, and session                                                          | Published |
| `@continuum-dev/react`                 | Headless React bindings                                                                                  | Published |
| `@continuum-dev/starter-kit`           | Slim preset layer: default component map, primitives, styles, React hook re-exports, and session tooling | Published |
| `@continuum-dev/starter-kit-ai`        | Default starter AI facade over starter-kit, ai-engine, ai-connect, and vercel-ai-sdk-adapter             | New       |
| `@continuum-dev/ai-core`               | Headless AI facade over react, core, session, ai-connect, ai-engine, and vercel-ai-sdk-adapter           | New       |
| `@continuum-dev/ai-engine`             | Shared headless AI planning, authoring, parsing, normalization, and apply helpers                        | New       |
| `@continuum-dev/ai-connect`            | Provider factories, registry helpers, and model catalog utilities                                        | Published |
| `@continuum-dev/vercel-ai-sdk-adapter` | Continuum adapter for Vercel AI SDK request and stream integration                                       | Published |
| `@continuum-dev/prompts`               | Shared prompt building primitives used by higher-level AI packages                                       | Published |

## Recommended reading path

If you are new:

1. [Quick Start](docs/QUICK_START.md)
2. [Starter Kit README](packages/starter-kit/README.md)
3. [Integration Guide](docs/INTEGRATION_GUIDE.md)

If you are wiring AI:

1. [AI Integration Guide](docs/AI_INTEGRATION.md)
2. [Starter Kit AI README](packages/starter-kit-ai/README.md)
3. [AI Core README](packages/ai-core/README.md)
4. [AI Engine README](packages/ai-engine/README.md)
5. [Vercel AI SDK Adapter README](packages/vercel-ai-sdk-adapter/README.md)

If you are upgrading:

1. [Starter Kit AI Migration Guide](docs/STARTER_KIT_AI_MIGRATION.md)
2. [Upgrade Guide](docs/UPGRADING_FROM_0.3.x_TO_NEXT.md)
3. [API Delta](docs/API_DELTA_0.3.x_TO_NEXT.md)

## Architecture

```text
@continuum-dev/contract
        |
@continuum-dev/runtime
        |
@continuum-dev/session
        |
@continuum-dev/core
        |
@continuum-dev/react
        |
@continuum-dev/starter-kit

@continuum-dev/ai-engine
        |
@continuum-dev/starter-kit-ai

@continuum-dev/ai-core

@continuum-dev/ai-connect
@continuum-dev/vercel-ai-sdk-adapter

apps/demo
apps/demo-api
```

The public package stack is layered on purpose:

- `starter-kit` is the slim preset layer
- `starter-kit-ai` is optional
- `ai-core` is the headless facade
- `ai-engine` is headless and reusable
- `vercel-ai-sdk-adapter` is the Vercel AI SDK adapter layer

## Development

```bash
npx nx run-many -t build
npx nx run-many -t test
npx nx run demo:typecheck
npx nx run demo:serve
npx nx run demo-api:dev
```

Publishing and release verification: [RELEASE.md](RELEASE.md). Package validation expectations: [docs/PACKAGE_VALIDATION_POLICY.md](docs/PACKAGE_VALIDATION_POLICY.md).

## License

MIT
