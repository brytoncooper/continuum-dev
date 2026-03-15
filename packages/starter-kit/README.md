# @continuum-dev/starter-kit

The fastest way to get Continuum on screen in a React app.

Website: [continuumstack.dev](https://continuumstack.dev)  
GitHub: [brytoncooper/continuum-dev](https://github.com/brytoncooper/continuum-dev)

Continuum itself is intentionally headless. The starter kit is the opinionated convenience layer on top of it.

It gives you:

- ready-to-use primitives for common Continuum node types
- a default component map
- proposal and suggestion UI helpers
- style customization hooks for the shipped primitives
- AI chat and session workbench primitives
- prompt helpers re-exported from `@continuum-dev/prompts`

## Install

```bash
npm install @continuum-dev/starter-kit react
```

Upgrade references:

- [Root upgrade guide](../../docs/UPGRADING_FROM_0.3.x_TO_NEXT.md)
- [API delta](../../docs/API_DELTA_0.3.x_TO_NEXT.md)

## Use the starter kit when

- you want the fastest possible React integration
- you want to render real `ViewDefinition` payloads immediately
- you do not want to build your own component map first
- you want proposal-aware and AI-ready UI primitives available from day one

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

The starter kit gives you one package surface for the most common tasks:

- `ContinuumProvider` and `ContinuumRenderer`
- common Continuum hooks such as `useContinuumSession`, `useContinuumSnapshot`, and diagnostics hooks
- `starterKitComponentMap`
- starter primitives and shared field helpers
- proposal UI such as conflict and suggestion components
- AI helpers such as `StarterKitProviderChatBox`, `StarterKitSessionWorkbench`, and provider factories
- prompt helpers re-exported from `@continuum-dev/prompts`

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

You can inspect the shipped defaults directly:

```tsx
import { starterKitDefaultStyles } from '@continuum-dev/starter-kit';

console.log(starterKitDefaultStyles.fieldControl);
```

Slot meanings:

- `fieldControl`: input, select, textarea, and date controls
- `sliderInput`: range input host element
- `actionButton`: action primitive button
- `collectionAddButton`: collection add button
- `itemRemoveButton`: collection row remove button
- `itemIconRemoveButton`: collection icon remove button
- `conflictActionButton`: conflict accept and reject buttons
- `suggestionsActionButton`: suggestions accept-all and reject-all buttons

## Built-in AI UI

The starter kit includes a ready-to-use provider chat primitive:

- `StarterKitProviderChatBox`
- `StarterKitVercelAiSdkChatBox`
- `StarterKitSessionWorkbench`

```tsx
import {
  ContinuumProvider,
  ContinuumRenderer,
  StarterKitProviderChatBox,
  StarterKitSessionWorkbench,
  createStarterKitGoogleProvider,
  createStarterKitOpenAiProvider,
  starterKitComponentMap,
} from '@continuum-dev/starter-kit';

const providers = [
  createStarterKitOpenAiProvider({
    apiKey: import.meta.env.VITE_OPENAI_API_KEY,
    model: 'gpt-5.4',
  }),
  createStarterKitGoogleProvider({
    apiKey: import.meta.env.VITE_GOOGLE_API_KEY,
  }),
];

export function App() {
  return (
    <ContinuumProvider components={starterKitComponentMap} persist="localStorage">
      <StarterKitProviderChatBox providers={providers} mode="evolve-view" />
      <StarterKitSessionWorkbench />
      <ContinuumRenderer view={view} />
    </ContinuumProvider>
  );
}
```

Behavior notes:

- if multiple providers are configured, the chat box shows a provider selector automatically
- Anthropic support is optional
- the chat box can auto-apply valid generated views into the active session

Execution notes:

- AI edits now flow through a shared Continuum execution planner: `state`, `patch`, or `view`
- localized edits stream directly, while full-view regenerations stay in a draft stream until final commit
- stateful nodes that must survive structural moves should keep a stable `semanticKey`
- `key` is still useful for binding data, but continuity across reshapes should not rely on `key` alone

## Post-processed model text and streaming

The starter kit keeps raw model text parsing outside the session/runtime core.

For the full render-vs-committed snapshot model and richer stream-part vocabulary, see [@continuum-dev/session streaming guide](../session/STREAMING.md).

That means you can:

- stream structured transport parts with `@continuum-dev/vercel-ai-sdk`
- or generate text, repair/parse it into a `ViewDefinition` or patch plan, and then normalize that into the same session streaming foundation

The built-in view generation engine now routes normalized outputs through the session stream API when it is available, so parsed AI results and structured transport chunks converge on the same deterministic foundation.

Why that matters:

- partial UI can render before the full response finishes
- user typing and browser autofill remain sacred while the UI is still building
- committed session state stays durable and checkpoint-friendly
- later renderer work can animate build states without changing the foundation again

## Vercel AI SDK option

If you want Vercel AI SDK to be the streaming transport while Continuum remains the runtime and session layer, use `StarterKitVercelAiSdkChatBox`.

```tsx
import { DefaultChatTransport } from 'ai';
import {
  ContinuumProvider,
  ContinuumRenderer,
  StarterKitVercelAiSdkChatBox,
  starterKitComponentMap,
} from '@continuum-dev/starter-kit';

export function App() {
  return (
    <ContinuumProvider components={starterKitComponentMap} persist="localStorage">
      <StarterKitVercelAiSdkChatBox
        chatOptions={{
          transport: new DefaultChatTransport({
            api: '/api/chat',
          }),
        }}
      />
      <ContinuumRenderer view={view} />
    </ContinuumProvider>
  );
}
```

You can also swap chat implementations explicitly with `StarterKitChatBox`:

```tsx
<StarterKitChatBox
  driver={{
    kind: 'vercel-ai-sdk',
    props: {
      chatOptions: {
        transport: new DefaultChatTransport({
          api: '/api/chat',
        }),
      },
    },
  }}
/>
```

## Provider composer helper

If you want one convenience function instead of separate provider factories:

```tsx
import {
  StarterKitProviderChatBox,
  StarterKitProviderComposer,
} from '@continuum-dev/starter-kit';

const providers = StarterKitProviderComposer({
  include: ['openai', 'google'],
  openai: { apiKey: import.meta.env.VITE_OPENAI_API_KEY },
  google: { apiKey: import.meta.env.VITE_GOOGLE_API_KEY },
});

export function AiBox() {
  return <StarterKitProviderChatBox providers={providers} mode="evolve-view" />;
}
```

If a provider is listed in `include`, its `apiKey` is required.

## When not to use this package

Do not start with the starter kit if:

- you need a completely custom rendering system immediately
- you do not want opinionated primitives in the bundle
- you are integrating at the session/runtime level rather than the React UI layer

In those cases, start with `@continuum-dev/react`, `@continuum-dev/core`, or `@continuum-dev/session`.

## Related docs

- [Root README](../../README.md)
- [Quick Start](../../docs/QUICK_START.md)
- [Integration Guide](../../docs/INTEGRATION_GUIDE.md)
- [AI Integration Guide](../../docs/AI_INTEGRATION.md)
- [View Contract Reference](../../docs/VIEW_CONTRACT.md)
