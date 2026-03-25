# @continuum-dev/ai-core

Convenience facade for the headless Continuum AI stack.

Use this package when one dependency edge is more valuable to you than learning the leaf packages directly.

This package is intentionally a facade. It does not define the architecture. It re-exports:

- `@continuum-dev/core`
- `@continuum-dev/react`
- `@continuum-dev/session`
- `@continuum-dev/ai-connect`
- `@continuum-dev/ai-engine`
- `@continuum-dev/vercel-ai-sdk-adapter`

## Install

```bash
npm install @continuum-dev/ai-core react
```

## What you get

- headless React bindings and session hooks
- session lifecycle, persistence, checkpoints, and proposals
- core contracts and reconciliation helpers
- provider factories and model catalog exports
- headless authoring, planning, parsing, normalization, and apply helpers
- Vercel AI SDK adapter and typed stream-part exports

## When to use this package

- you already understand the `react` + `session` + `ai-engine` + adapter split
- you want one public import surface in an app or integration package
- you are optimizing package ergonomics, not learning the system for the first time

## When not to use this package

- you are trying to understand where rendering, state, execution, and transport responsibilities live
- you want the clearest semver and dependency boundaries
- you are following the main adoption docs for the first time

In those cases, start with:

- `@continuum-dev/react` for headless React rendering
- `@continuum-dev/session` for the explicit stateful spine
- `@continuum-dev/ai-engine` for execution behavior
- `@continuum-dev/vercel-ai-sdk-adapter` or `@continuum-dev/ai-connect` for the outer AI edge

## Related docs

- [Root README](../../README.md)
- [AI Integration Guide](../../docs/AI_INTEGRATION.md)
- [Integration Guide](../../docs/INTEGRATION_GUIDE.md)
