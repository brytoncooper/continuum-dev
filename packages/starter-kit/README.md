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
