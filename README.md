# Continuum

**State continuity for view-driven and AI-generated UIs.**

Website: [continuumstack.dev](https://continuumstack.dev)  
GitHub: [brytoncooper/continuum-dev](https://github.com/brytoncooper/continuum-dev)

Continuum keeps UI structure and user intent separate, then reconciles them deterministically as views change.

> [!WARNING]
> Continuum is pre-release. The package surfaces are usable, but APIs and docs may still evolve quickly.

## Why This Exists

AI-generated and server-driven UIs make it easy to change screens quickly.

The hard part is not rendering the next screen. The hard part is preserving what the user already meant when that screen changes.

Continuum exists so you can:

- regenerate a form without wiping what the user already entered
- ship a new server-authored view without corrupting existing state
- keep one durable session across refreshes, rewinds, and AI edits

## How It Works

1. Your app renders a `ViewDefinition`.
2. A Continuum session stores canonical data separately from that view.
3. When a new view or AI-generated change arrives, it goes through Continuum runtime and session logic instead of overwriting raw app state.
4. Matching nodes keep values by identity and continuity metadata such as `id`, `key`, `semanticKey`, and compatible shape.
5. Continuum records issues, diffs, resolutions, checkpoints, and detached values so continuity decisions stay inspectable.

Important AI detail:

- structural AI results are checked and applied through the same local Continuum session
- AI value suggestions still go through session write and proposal policy
- the model does not directly mutate raw session internals

## What It Is

Continuum is an open-source SDK with a layered package stack:

- `@continuum-dev/runtime` and `@continuum-dev/session`
  - the continuity core
- `@continuum-dev/react` and `@continuum-dev/starter-kit`
  - React rendering and session bindings
- `@continuum-dev/ai-engine`, `@continuum-dev/ai-connect`, and `@continuum-dev/vercel-ai-sdk-adapter`
  - headless AI execution plus provider and transport integration
- `@continuum-dev/starter-kit-ai`
  - the fastest shipped path to a React session with AI chat
- `@continuum-dev/core` and `@continuum-dev/ai-core`
  - convenience facades after you understand the lower-level layers

## Start Here

Most users should start with one of these paths.

| If you want | Start here | Why |
| --- | --- | --- |
| A Continuum session with AI as fast as possible | [Quick Start](docs/QUICK_START.md) | fastest copy-paste path using `@continuum-dev/starter-kit-ai` |
| To keep an existing Vercel AI SDK app and add Continuum | [AI Integration Guide](docs/AI_INTEGRATION.md) | keeps your current transport and route shape while Continuum owns view and state continuity |
| Broader production patterns and package choices | [Integration Guide](docs/INTEGRATION_GUIDE.md) | shows when to use starter, headless React, adapter, or lower-level runtime and session layers |

## Fastest Path: Live Session Plus AI

If you want one session, one renderer, and one AI instruction surface with the fewest moving parts, start with `@continuum-dev/starter-kit-ai`.

```bash
npm install @continuum-dev/starter-kit-ai react react-dom
```

```tsx
import { useEffect } from 'react';
import {
  ContinuumProvider,
  ContinuumRenderer,
  StarterKitProviderChatBox,
  createAiConnectProviders,
  starterKitComponentMap,
  useContinuumSession,
  useContinuumSnapshot,
  type ViewDefinition,
} from '@continuum-dev/starter-kit-ai';

const providers = createAiConnectProviders({
  include: ['openai'],
  openai: {
    apiKey: import.meta.env.VITE_OPENAI_API_KEY,
    model: import.meta.env.VITE_OPENAI_MODEL ?? 'gpt-4o-mini',
  },
});

const initialView: ViewDefinition = {
  viewId: 'profile',
  version: '1',
  nodes: [
    {
      id: 'profile',
      type: 'group',
      label: 'Profile',
      children: [
        {
          id: 'email',
          type: 'field',
          dataType: 'string',
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
      // First mount: seed the session before the AI lane edits it.
      session.pushView(initialView);
    }
  }, [session]);

  if (!snapshot?.view) {
    return null;
  }

  return (
    <>
      <StarterKitProviderChatBox
        providers={providers}
        title="Ask Continuum AI"
        description="AI results apply back into this same Continuum session."
      />
      <ContinuumRenderer view={snapshot.view} />
    </>
  );
}

export function App() {
  return (
    <ContinuumProvider
      components={starterKitComponentMap}
      persist="localStorage"
    >
      <Screen />
    </ContinuumProvider>
  );
}
```

What this gives you:

- one active Continuum session inside `ContinuumProvider`
- a rendered starting view
- local persistence across refreshes
- an AI chat box that reads and updates that same session

If you do not want provider credentials in the browser, use the Vercel AI SDK path instead.

## Existing Vercel AI SDK App

If you already have a Vercel AI SDK chat route, keep that route and add Continuum around it.

The public integration pattern is:

1. send `currentView` and `currentData` with each request
2. run Continuum execution on the server with `createContinuumVercelAiSdkRouteHandler(...)`
3. let `useContinuumVercelAiSdkChat(...)` apply streamed Continuum parts back into the session

Client:

```tsx
import { DefaultChatTransport } from 'ai';
import { useContinuumSession } from '@continuum-dev/react';
import {
  buildContinuumVercelAiSdkRequestBody,
  useContinuumVercelAiSdkChat,
} from '@continuum-dev/vercel-ai-sdk-adapter';

export function ContinuumChat() {
  const session = useContinuumSession();

  const chat = useContinuumVercelAiSdkChat({
    session,
    transport: new DefaultChatTransport({
      api: '/api/chat',
      body: () => {
        const snapshot = session.getSnapshot();
        return buildContinuumVercelAiSdkRequestBody({
          currentView: snapshot?.view ?? null,
          currentData: snapshot?.data.values ?? null,
          continuum: {
            mode: 'evolve-view',
            authoringFormat: 'line-dsl',
          },
        });
      },
    }),
  });

  return (
    <button onClick={() => chat.sendMessage({ text: 'Add a phone field.' })}>
      Send
    </button>
  );
}
```

Server:

```ts
import { openai } from '@ai-sdk/openai';
import {
  createContinuumVercelAiSdkRouteHandler,
  createVercelAiSdkContinuumExecutionAdapter,
} from '@continuum-dev/vercel-ai-sdk-adapter/server';

export const POST = createContinuumVercelAiSdkRouteHandler({
  adapter: createVercelAiSdkContinuumExecutionAdapter({
    model: openai(process.env.OPENAI_MODEL ?? 'gpt-4o-mini'),
  }),
  defaultAuthoringFormat: 'line-dsl',
});
```

Use the full walkthrough in [AI Integration Guide](docs/AI_INTEGRATION.md) when you want the complete client and server path.

## Docs

- [Docs Index](docs/README.md)
- [Quick Start](docs/QUICK_START.md)
- [AI Integration Guide](docs/AI_INTEGRATION.md)
- [Integration Guide](docs/INTEGRATION_GUIDE.md)
- [View Contract Reference](docs/VIEW_CONTRACT.md)

## Package Map

| Package | Role |
| --- | --- |
| `@continuum-dev/contract` | declarative view and data contracts |
| `@continuum-dev/protocol` | shared operational protocols above the model layer |
| `@continuum-dev/runtime` | deterministic reconciliation engine |
| `@continuum-dev/session` | stateful session lifecycle, checkpoints, rewind, persistence, and streaming coordination |
| `@continuum-dev/react` | headless React bindings |
| `@continuum-dev/starter-kit` | preset React renderer, primitives, styles, and session tooling |
| `@continuum-dev/ai-engine` | headless AI execution, parsing, normalization, and apply helpers |
| `@continuum-dev/ai-connect` | provider clients, registries, and model catalogs |
| `@continuum-dev/vercel-ai-sdk-adapter` | Vercel AI SDK request and streamed-part bridge |
| `@continuum-dev/starter-kit-ai` | starter-oriented AI chat wrappers over the public AI stack |
| `@continuum-dev/core` | convenience facade over `contract`, `runtime`, and `session` |
| `@continuum-dev/ai-core` | convenience facade over the headless AI stack |

## Run The Repository Example

The included [`apps/starter`](apps/starter/README.md) app follows the Vercel AI SDK path.

From the repository root:

```bash
npm run build:release-packages
npm run starter
```

Dev server: **http://localhost:4305/**

## Library Consumers Versus This Monorepo

- npm consumers install published packages from the prepared package outputs
- repo apps under `apps/*` are integration and composition surfaces, not the canonical proof of published package layout
- do not change public package exports only to satisfy one repo app

Workspace-only `.js` entry files under `packages/*/`, when present, are generated by `npm run sync:workspace-entrypoints` and must not be edited by hand.

## Upgrading From 0.3.x

Public integration help lives in [docs/README.md](docs/README.md) and the package READMEs. Detailed maintainer migration notes and API delta references live in the private Continuum documentation repository.

## Development

Contributors and coding agents: [AI_ONBOARDING.md](AI_ONBOARDING.md) maps the monorepo, anchor files, and workspace conventions.

```bash
npx nx run-many -t build
npx nx run-many -t test
npx nx run starter:typecheck
npx nx run starter:serve
```

Publishing and release verification: [RELEASE.md](RELEASE.md)

## License

MIT
