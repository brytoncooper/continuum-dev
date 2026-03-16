# @continuum-dev/starter-kit

The fastest way to get Continuum on screen in a React app.

Website: [continuumstack.dev](https://continuumstack.dev)  
GitHub: [brytoncooper/continuum-dev](https://github.com/brytoncooper/continuum-dev)

Continuum itself is intentionally headless. The starter kit is the slim preset layer on top of it.

It gives you:

- ready-to-use primitives for common Continuum node types
- a default component map
- proposal and restore-review UI helpers
- style customization hooks for the shipped primitives
- React hook re-exports for the common session APIs
- `StarterKitSessionWorkbench` for timeline and session inspection

## Install

```bash
npm install @continuum-dev/starter-kit react
```

Upgrade references:

- [Root upgrade guide](../../docs/UPGRADING_FROM_0.3.x_TO_NEXT.md)
- [Starter Kit AI migration guide](../../docs/STARTER_KIT_AI_MIGRATION.md)
- [API delta](../../docs/API_DELTA_0.3.x_TO_NEXT.md)

## Use the starter kit when

- you want the fastest possible React integration
- you want to render real `ViewDefinition` payloads immediately
- you do not want to build your own component map first
- you want session tooling and a polished default UI surface

If you want a fully headless React integration instead, start with `@continuum-dev/react`.

## Fastest possible example

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

const view: ViewDefinition = {
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
      ],
    },
  ],
};

function Page() {
  const session = useContinuumSession();
  const snapshot = useContinuumSnapshot();

  useEffect(() => {
    if (!snapshot) {
      session.pushView(view);
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

## What this package exports

The starter kit gives you one package surface for the most common rendering and session tasks:

- `ContinuumProvider` and `ContinuumRenderer`
- common hooks such as `useContinuumSession`, `useContinuumSnapshot`, and diagnostics hooks
- `starterKitComponentMap`
- starter primitives and shared field helpers
- proposal and restore-review UI
- `StarterKitStyleProvider` and default style tokens
- `StarterKitSessionWorkbench`

## Styling the shipped primitives

The primitives ship with stable defaults. Override the exposed style slots with `StarterKitStyleProvider`.

```tsx
import {
  ContinuumProvider,
  ContinuumRenderer,
  StarterKitStyleProvider,
  starterKitComponentMap,
} from '@continuum-dev/starter-kit';

export function App() {
  return (
    <StarterKitStyleProvider
      styles={{
        fieldControl: { borderRadius: 10 },
        actionButton: { background: '#0f172a' },
        suggestionsActionButton: { borderRadius: 999 },
      }}
    >
      <ContinuumProvider components={starterKitComponentMap} persist="localStorage">
        <ContinuumRenderer view={view} />
      </ContinuumProvider>
    </StarterKitStyleProvider>
  );
}
```

Supported slots:

- `fieldControl`
- `sliderInput`
- `actionButton`
- `collectionAddButton`
- `itemRemoveButton`
- `itemIconRemoveButton`
- `conflictActionButton`
- `suggestionsActionButton`

## Session workbench

`StarterKitSessionWorkbench` stays in this package because it is session tooling, not provider-specific AI UI.

```tsx
import { StarterKitSessionWorkbench } from '@continuum-dev/starter-kit';

export function DebugPanel() {
  return <StarterKitSessionWorkbench />;
}
```

## Optional AI UI now lives in `@continuum-dev/starter-kit-ai`

The starter kit no longer exports provider factories, prompt helpers, or chat wrappers directly.

Use these packages together when you want the higher-level AI lane:

- `@continuum-dev/starter-kit` for rendering and session tooling
- `@continuum-dev/starter-kit-ai` for thin chat wrappers
- `@continuum-dev/ai-connect` for provider factories and model catalogs
- `@continuum-dev/ai-engine` for headless planning, authoring, parsing, normalization, and apply helpers

Example:

```tsx
import {
  createAiConnectProviders,
  getAiConnectModelCatalog,
  ContinuumProvider,
  ContinuumRenderer,
  StarterKitSessionWorkbench,
  StarterKitProviderChatBox,
  starterKitComponentMap,
} from '@continuum-dev/starter-kit-ai';

const providers = createAiConnectProviders({
  include: ['openai'],
  openai: {
    apiKey: import.meta.env.VITE_OPENAI_API_KEY,
    model: 'gpt-5',
  },
});

const models = getAiConnectModelCatalog(providers);

export function App() {
  return (
    <ContinuumProvider components={starterKitComponentMap} persist="localStorage">
      <StarterKitProviderChatBox providers={providers} models={models} mode="evolve-view" />
      <StarterKitSessionWorkbench />
      <ContinuumRenderer view={view} />
    </ContinuumProvider>
  );
}
```

## When not to use this package

Do not start with the starter kit if:

- you need a completely custom rendering system immediately
- you do not want opinionated primitives in the bundle
- you are integrating at the session or transport level rather than the React preset layer

In those cases, start with `@continuum-dev/ai-core` for the headless AI lane, or drop to the lower-level packages directly if you want fully explicit dependencies.

## Related docs

- [Root README](../../README.md)
- [Quick Start](../../docs/QUICK_START.md)
- [Integration Guide](../../docs/INTEGRATION_GUIDE.md)
- [AI Integration Guide](../../docs/AI_INTEGRATION.md)
- [Starter Kit AI README](../starter-kit-ai/README.md)
- [AI Engine README](../ai-engine/README.md)
- [Starter Kit AI Migration Guide](../../docs/STARTER_KIT_AI_MIGRATION.md)
