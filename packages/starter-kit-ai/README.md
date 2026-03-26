# @continuum-dev/starter-kit-ai

```bash
npm install @continuum-dev/starter-kit-ai react
```

## Why It Exists

`@continuum-dev/starter-kit` gets a Continuum interface on screen quickly, but it does not give you an AI instruction surface by itself.

`@continuum-dev/starter-kit-ai` exists for the next step up:

- a shipped chat box shell
- a direct provider-backed AI lane
- a Vercel AI SDK transport lane
- controller hooks when you want the logic without the shipped shell

It is for teams who want the starter-kit rendering path and a thin AI UI layer without building the whole chat surface first.

## How It Works

- it assumes there is already an active Continuum session in React context
- `StarterKitProviderChatBox` delegates execution to `@continuum-dev/ai-engine` using `@continuum-dev/ai-connect` providers
- `StarterKitVercelAiSdkChatBox` delegates chat transport to `@continuum-dev/vercel-ai-sdk-adapter`
- both lanes write back into the same Continuum session that your renderer is already using
- `StarterKitChatBox` is a small driver wrapper that switches between those two lanes
- the controller hooks expose the same logic without forcing the shipped chat shell

### Normal Starter Kit AI Order

1. mount `ContinuumProvider`
2. render the current Continuum view
3. mount one AI chat lane against the same provider subtree
4. submit an instruction
5. let the lane apply the resulting Continuum update back into session state
6. render the next snapshot or streamed result

## What It Is

`@continuum-dev/starter-kit-ai` is an opinionated React AI UI add-on over `@continuum-dev/starter-kit` and the headless Continuum AI packages.

Import everything from the package root:

```ts
import {
  ContinuumProvider,
  ContinuumRenderer,
  StarterKitProviderChatBox,
  StarterKitVercelAiSdkChatBox,
  starterKitComponentMap,
  useContinuumSnapshot,
} from '@continuum-dev/starter-kit-ai';
```

The public root export includes:

- everything from `@continuum-dev/starter-kit`
- everything from `@continuum-dev/ai-connect`
- everything from `@continuum-dev/ai-engine`
- everything from `@continuum-dev/vercel-ai-sdk-adapter`
- local chat box components and controller hooks from this package

There are no public subpath imports.

The re-exports are for convenience. The conceptual boundaries still live in the underlying packages.

## Simplest Way To Use It

The absolute shortest path is `StarterKitProviderChatBox`.

Use it when you want the thinnest direct provider-backed lane and you are comfortable supplying provider clients directly.

### Minimal Flow

```tsx
import { useEffect } from 'react';
import {
  createAiConnectProviders,
  ContinuumProvider,
  ContinuumRenderer,
  StarterKitProviderChatBox,
  starterKitComponentMap,
  useContinuumSession,
  useContinuumSnapshot,
  type ViewDefinition,
} from '@continuum-dev/starter-kit-ai';

const providers = createAiConnectProviders({
  include: ['openai'],
  openai: {
    apiKey: import.meta.env.VITE_OPENAI_API_KEY,
    model: 'gpt-5',
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

function Page() {
  const session = useContinuumSession();
  const snapshot = useContinuumSnapshot();

  useEffect(() => {
    if (!session.getSnapshot()) {
      // First mount: seed the session before the AI lane starts editing it.
      session.pushView(initialView);
    }
  }, [session]);

  if (!snapshot?.view) {
    return null;
  }

  // The chat box and the renderer both work against the same Continuum session.
  return <ContinuumRenderer view={snapshot.view} />;
}

export function App() {
  return (
    <ContinuumProvider components={starterKitComponentMap}>
      <StarterKitProviderChatBox
        providers={providers}
        title="Ask Continuum AI"
      />
      <Page />
    </ContinuumProvider>
  );
}
```

### What Is Required

- React 18 or newer
- an active `ContinuumProvider`
- a rendered Continuum page
- for the provider lane: at least one `AiConnectClient`
- for the Vercel lane: a compatible Vercel AI SDK chat route

## Other Options

### Quick Start Guide

For the easiest copy-paste lane selection, see [QUICK_START.md](./QUICK_START.md).

### Vercel AI SDK Lane

Use `StarterKitVercelAiSdkChatBox` when:

- you already have a server-backed Vercel AI SDK route
- you want transport-managed streaming behavior
- you want attachment file handling in the shipped UI

The important contract detail is:

- `chatOptions` intentionally does not accept `session`
- the component reads the active Continuum session from provider context

### Driver Wrapper

Use `StarterKitChatBox` when the lane choice is data-driven:

```ts
type StarterKitChatBoxDriver =
  | { kind: 'provider'; props: StarterKitProviderChatBoxProps }
  | { kind: 'vercel-ai-sdk'; props: StarterKitVercelAiSdkChatBoxProps };
```

### Controller Hooks

Use the controller hooks when you want the behavior without the shipped shell:

- `useProviderChatController(...)`
- `useVercelAiSdkChatController(...)`

That is the right path when your app wants a custom chat surface but not a custom execution pipeline.

### Security And Boundary Guidance

The two lanes are not equivalent:

- `StarterKitProviderChatBox`
  - fastest direct provider-backed path
  - text-first lane
  - better for quick demos or controlled environments
- `StarterKitVercelAiSdkChatBox`
  - better fit when you want a server-backed transport boundary
  - the shipped lane that handles attachment files

If you do not want provider credentials flowing through the browser, prefer the server-backed transport lane.

## Related Packages

- `@continuum-dev/starter-kit`
  - the preset React rendering layer below this package
- `@continuum-dev/ai-engine`
  - the headless Continuum execution logic used by the provider lane
- `@continuum-dev/vercel-ai-sdk-adapter`
  - the transport integration used by the Vercel lane

## Dictionary Contract

### Core Terms

- `provider lane`
  - the `StarterKitProviderChatBox` path backed by `ai-connect` providers and `ai-engine`
- `vercel lane`
  - the `StarterKitVercelAiSdkChatBox` path backed by the Vercel AI SDK adapter
- `chat controller`
  - the hook-level state and submit logic behind the shipped shell
- `driver`
  - the discriminated union used by `StarterKitChatBox`

### `StarterKitChatBoxDriver.kind`

```ts
'provider' | 'vercel-ai-sdk'
```

### Provider Chat Box Defaults

```ts
mode = 'evolve-view'
authoringFormat = 'line-dsl'
autoApplyView = true
enableSuggestedPrompts = false
showSuggestedPromptCopyButton = true
```

### Vercel Chat Box Defaults

```ts
enableSuggestedPrompts = false
showSuggestedPromptCopyButton = true
submitDisabled = false
```

### Local Root Exports

```ts
StarterKitProviderChatBox
StarterKitVercelAiSdkChatBox
StarterKitChatBox
useProviderChatController
useVercelAiSdkChatController
```

### Lane Differences

- attachment files
  - handled by the Vercel lane
- `session`
  - always taken from the active provider context, not passed as a prop to the chat box components

## License

MIT
