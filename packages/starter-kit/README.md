# @continuum-dev/starter-kit

Website: [continuumstack.dev](https://continuumstack.dev)
GitHub: [brytoncooper/continuum-dev](https://github.com/brytoncooper/continuum-dev)

`@continuum-dev/starter-kit` is the fastest way to get Continuum on screen in a React app.

Continuum itself stays headless by design. The starter kit is the opinionated convenience layer:

- ready-to-use primitives for common Continuum node types
- a default component map
- proposal and suggestion UI helpers
- prompt helpers re-exported from `@continuum-dev/prompts`

## Install

```bash
npm install @continuum-dev/starter-kit react
```

## Use it when

- you want a polished starting point instead of building your own component map first
- you want proposal-safe UI ready on day one
- you want prompt helpers available from the same package surface

## Example

```tsx
import { ContinuumProvider, ContinuumRenderer, starterKitComponentMap } from '@continuum-dev/starter-kit';

export function App() {
  return (
    <ContinuumProvider components={starterKitComponentMap} persist="localStorage">
      <ContinuumRenderer view={view} />
    </ContinuumProvider>
  );
}
```

## Optional style customization

Starter kit primitives now ship with stable defaults, and you can override key style slots with `StarterKitStyleProvider`.

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

Supported slots: `fieldControl`, `sliderInput`, `actionButton`, `collectionAddButton`, `itemRemoveButton`, `itemIconRemoveButton`, `conflictActionButton`, `suggestionsActionButton`.
You can also inspect the exact shipped defaults in code with `starterKitDefaultStyles`.

```tsx
import { starterKitDefaultStyles } from '@continuum-dev/starter-kit';

console.log(starterKitDefaultStyles.fieldControl);
```

Default slots and what they target:

- `fieldControl`: input/select/textarea/date controls
- `sliderInput`: range input host element
- `actionButton`: `action` primitive button
- `collectionAddButton`: collection "Add item" button
- `itemRemoveButton`: collection item remove button (text)
- `itemIconRemoveButton`: collection item remove button (icon)
- `conflictActionButton`: accept/reject buttons in `ConflictBanner`
- `suggestionsActionButton`: accept all / reject all in `StarterKitSuggestionsBar`
## AI provider chat primitive

Starter kit includes a ready-to-use headless-provider chat control: `StarterKitProviderChatBox`.

```tsx
import {
  ContinuumProvider,
  ContinuumRenderer,
  StarterKitProviderChatBox,
  starterKitComponentMap,
} from '@continuum-dev/starter-kit';
import {
  createGoogleClient,
  createOpenAiClient,
} from '@continuum-dev/ai-connect';

const providers = [
  createOpenAiClient({ apiKey: import.meta.env.VITE_OPENAI_API_KEY }),
  createGoogleClient({ apiKey: import.meta.env.VITE_GOOGLE_API_KEY }),
];

export function App() {
  return (
    <ContinuumProvider components={starterKitComponentMap} persist="localStorage">
      <StarterKitProviderChatBox providers={providers} mode="evolve-view" />
      <ContinuumRenderer view={view} />
    </ContinuumProvider>
  );
}
```

If multiple providers are configured, the primitive shows a provider select automatically.
### Provider composer helper

Use `StarterKitProviderComposer` to build providers from one config object:

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

<StarterKitProviderChatBox providers={providers} mode="evolve-view" />;
```

If a provider is listed in `include`, its `apiKey` is required.