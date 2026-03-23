# @continuum-dev/starter-kit-ai

Optional thin AI wrappers for `@continuum-dev/starter-kit`.

Use this package when you already want the preset React path from `starter-kit` and you want prebuilt chat controls instead of building custom AI UI first.

Do not start here just because it re-exports more packages. The actual architecture still lives in:

- `@continuum-dev/starter-kit` for preset rendering and session tooling
- `@continuum-dev/react` and `@continuum-dev/session` for the live runtime state
- `@continuum-dev/ai-engine` for headless execution behavior
- `@continuum-dev/vercel-ai-sdk-adapter` or `@continuum-dev/ai-connect` for outer integrations

## Install

```bash
npm install @continuum-dev/starter-kit-ai react
```

## Start with these exports

- `StarterKitProviderChatBox` when you want provider-backed chat controls
- `StarterKitVercelAiSdkChatBox` when Vercel AI SDK is your transport
- `useProviderChatController` and `useVercelAiSdkChatController` when you want the controller logic without the shipped shell

## What this package re-exports

- starter-kit rendering and session exports
- ai-connect provider and model catalog exports
- ai-engine authoring and planner exports
- Vercel AI SDK adapter exports
- `StarterKitChatBox`

## Minimal usage

```tsx
import {
  createAiConnectProviders,
  ContinuumProvider,
  ContinuumRenderer,
  StarterKitProviderChatBox,
  starterKitComponentMap,
  useContinuumSnapshot,
} from '@continuum-dev/starter-kit-ai';

const providers = createAiConnectProviders({
  include: ['openai'],
  openai: {
    apiKey: import.meta.env.VITE_OPENAI_API_KEY,
    model: 'gpt-5',
  },
});

function Page() {
  const snapshot = useContinuumSnapshot();
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
      <StarterKitProviderChatBox
        providers={providers}
        mode="evolve-view"
      />
      <Page />
    </ContinuumProvider>
  );
}
```

## When not to use this package

- you want to learn the headless Continuum AI stack directly
- you want custom AI UI or custom server orchestration first
- you do not want the `starter-kit` preset layer in the bundle

In those cases, start with `@continuum-dev/react`, `@continuum-dev/ai-engine`, and the transport layer you need. If you prefer one dependency edge after you understand the architecture, `@continuum-dev/ai-core` is the convenience facade for that path.

## Related docs

- [Root README](../../README.md)
- [Quick Start](../../docs/QUICK_START.md)
- [Starter reference app](../../docs/REFERENCE_STARTER_APP.md)
- [AI Integration Guide](../../docs/AI_INTEGRATION.md)
- [Integration Guide](../../docs/INTEGRATION_GUIDE.md)
- [Headless AI reference app](../../docs/REFERENCE_HEADLESS_AI_APP.md)
