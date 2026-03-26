# @continuum-dev/ai-core

`@continuum-dev/ai-core` is the convenience entrypoint for the full headless Continuum AI app stack.

## Why This Exists

Some apps want one dependency edge for the whole headless Continuum AI stack instead of naming `core`, `react`, `session`, `ai-connect`, `ai-engine`, and the Vercel AI SDK adapter separately. `ai-core` exists for that case. It is useful when package ergonomics matter more than teaching the package boundaries one by one.

## How It Works

`@continuum-dev/ai-core` does not add a new execution, rendering, or transport layer. It re-exports the root public APIs of:

- `@continuum-dev/core`
- `@continuum-dev/react`
- `@continuum-dev/session`
- `@continuum-dev/ai-connect`
- `@continuum-dev/ai-engine`
- `@continuum-dev/vercel-ai-sdk-adapter`

So importing from `ai-core` still gives you those same APIs and behaviors. It just collapses the import surface.

## What It Is

This package is a facade for app authors who already want the full headless stack from one place. It is not the owner of the architecture, and it is not the best first package for learning how the stack is divided.

## Install

```bash
npm install @continuum-dev/ai-core react
```

## Easiest Path

Use `ai-core` only when you already know the leaf packages you want and just want one import surface.

```ts
import {
  ContinuumProvider,
  createAiConnectProviders,
  createAiConnectContinuumExecutionAdapter,
  createContinuumSessionAdapter,
  runContinuumExecution,
} from '@continuum-dev/ai-core';

// These are the same root exports from the leaf packages.
// `ai-core` just lets you import them from one place.
```

That is the whole point of this package: import consolidation, not new behavior.

## Other Options

### Learn the boundaries directly

Start with the leaf packages when you are still learning the system:

- `@continuum-dev/react`
- `@continuum-dev/session`
- `@continuum-dev/ai-engine`
- `@continuum-dev/ai-connect`
- `@continuum-dev/vercel-ai-sdk-adapter`

### Import leaf subpaths directly when you need them

`ai-core` only re-exports package roots. It does not stand in for leaf subpaths like:

- `@continuum-dev/vercel-ai-sdk-adapter/server`
- `@continuum-dev/ai-engine/continuum-execution`
- `@continuum-dev/ai-engine/execution-stream`
- `@continuum-dev/runtime/view-stream`

If you need those, import the leaf subpath itself.

## Dictionary Contract

`@continuum-dev/ai-core` adds no new literals or runtime behavior of its own. Its contract is the union of the root exports of:

- `@continuum-dev/core`
- `@continuum-dev/react`
- `@continuum-dev/session`
- `@continuum-dev/ai-connect`
- `@continuum-dev/ai-engine`
- `@continuum-dev/vercel-ai-sdk-adapter`

That means:

- the package is a facade, not a new architecture layer
- root exports come through `ai-core`
- leaf subpaths do not

## Related Docs

- [Root README](../../README.md)
- [AI Integration Guide](../../docs/AI_INTEGRATION.md)
- [Integration Guide](../../docs/INTEGRATION_GUIDE.md)
- [React README](../react/README.md)
- [AI Connect README](../ai-connect/README.md)
- [AI Engine README](../ai-engine/README.md)
- [Vercel AI SDK Adapter README](../vercel-ai-sdk-adapter/README.md)
