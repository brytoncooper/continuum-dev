# @continuum-dev/starter-kit-ai

Optional AI facade for Continuum starter-kit integrations.

Use this package when you want the default AI path under one stable package name.

It re-exports the common starter AI surface from:

- `@continuum-dev/starter-kit`
- `@continuum-dev/ai-connect`
- `@continuum-dev/ai-engine`
- `@continuum-dev/vercel-ai-sdk-adapter`

## Install

```bash
npm install @continuum-dev/starter-kit-ai react
```

## Exports

- starter-kit rendering and session exports
- ai-connect provider and model catalog exports
- ai-engine authoring and planner exports
- Vercel AI SDK adapter exports
- `StarterKitProviderChatBox`
- `StarterKitVercelAiSdkChatBox`
- `StarterKitChatBox`
- `useProviderChatController`
- `useVercelAiSdkChatController`

The wrappers stay intentionally thin. Prompt construction, planning, parsing, normalization, and apply behavior still live in `@continuum-dev/ai-engine` underneath.
