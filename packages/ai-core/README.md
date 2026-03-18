# @continuum-dev/ai-core

Headless AI facade for Continuum.

Use this package when you want the raw continuity and transport lane under one stable package name.

It re-exports the common headless AI surface from:

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

## Exports

- headless React bindings and session hooks
- session lifecycle, persistence, checkpoints, and proposals
- core contracts and reconciliation helpers
- provider factories and model catalog exports
- headless authoring, planning, parsing, normalization, and apply helpers
- Vercel AI SDK adapter and typed stream-part exports

This facade keeps the install and import surface small for custom UI and orchestration paths. If you want full package-by-package control, the lower-level packages remain available directly.
