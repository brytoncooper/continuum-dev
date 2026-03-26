# Starter Kit AI Quick Start

This package is easiest to understand if you pick a lane first.

## Choose A Lane

### `StarterKitProviderChatBox`

Use this when you want:

- the fastest direct provider-backed demo path
- `ai-connect` providers
- automatic Continuum result application by default

Good for quick prototypes.

### `StarterKitVercelAiSdkChatBox`

Use this when you want:

- a server-backed Vercel AI SDK route
- streamed Continuum updates
- file attachment handling in the shipped chat UI

Good for apps that already have a server transport boundary.

## Common Base

Both lanes assume the same Continuum page shape:

```tsx
import { useEffect } from 'react';
import {
  ContinuumRenderer,
  starterKitComponentMap,
  useContinuumSession,
  useContinuumSnapshot,
  type ViewDefinition,
} from '@continuum-dev/starter-kit-ai';

export const initialView: ViewDefinition = {
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

export function Page() {
  const session = useContinuumSession();
  const snapshot = useContinuumSnapshot();

  useEffect(() => {
    if (!session.getSnapshot()) {
      session.pushView(initialView);
    }
  }, [session]);

  if (!snapshot?.view) {
    return null;
  }

  return <ContinuumRenderer view={snapshot.view} />;
}
```

## Lane 1: Direct Provider Chat

```tsx
import {
  createAiConnectProviders,
  ContinuumProvider,
  StarterKitProviderChatBox,
  starterKitComponentMap,
} from '@continuum-dev/starter-kit-ai';
import { Page } from './page';

const providers = createAiConnectProviders({
  include: ['openai'],
  openai: {
    apiKey: import.meta.env.VITE_OPENAI_API_KEY,
    model: 'gpt-5',
  },
});

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

Useful defaults in this lane:

- `mode="evolve-view"`
- `authoringFormat="line-dsl"`
- `autoApplyView={true}`

## Lane 2: Vercel AI SDK Chat

```tsx
import {
  ContinuumProvider,
  StarterKitVercelAiSdkChatBox,
  starterKitComponentMap,
} from '@continuum-dev/starter-kit-ai';
import { Page } from './page';

export function App() {
  return (
    <ContinuumProvider components={starterKitComponentMap}>
      <StarterKitVercelAiSdkChatBox
        title="Ask Continuum AI"
        chatOptions={{
          api: '/api/chat',
        }}
      />
      <Page />
    </ContinuumProvider>
  );
}
```

Important detail:

- do not pass `session` in `chatOptions`
- the component reads the active Continuum session from `ContinuumProvider`

## Two Good Next Steps

### Add The Session Workbench

```tsx
import { StarterKitSessionWorkbench } from '@continuum-dev/starter-kit-ai';

<StarterKitSessionWorkbench initialView={initialView} />;
```

### Build Your Own Chat UI Around The Controllers

```tsx
import { useProviderChatController } from '@continuum-dev/starter-kit-ai';
```

Use the controller hooks when you want the shipped execution behavior but your own visual shell.
