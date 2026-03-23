# Starter app

Vite + React app that follows [docs/QUICK_START.md](../../docs/QUICK_START.md) and [docs/INTEGRATION_GUIDE.md](../../docs/INTEGRATION_GUIDE.md):

- `@continuum-dev/starter-kit` — `ContinuumProvider`, `starterKitComponentMap`, `StarterKitSessionWorkbench`, `ContinuumRenderer`, default styles
- `@continuum-dev/vercel-ai-sdk-adapter` — `useContinuumVercelAiSdkChat`, `buildContinuumVercelAiSdkRequestBody`, and a dev-only `POST /api/chat` route backed by `createContinuumVercelAiSdkRouteHandler` from `@continuum-dev/vercel-ai-sdk-adapter/server`

## Run

From the repository root, build public packages once so `dist/packages/*` exists (needed for the dev `POST /api/chat` route and workspace Node resolution):

```bash
npm run build:release-packages
```

Then:

```bash
npm run starter
```

Dev server: **http://localhost:4305/**

This app is an internal integration harness; it is not the canonical check for what npm consumers install. Release verification uses `npm run verify:release-packages` after `prepare:dist-packages`.

### Model API key

The chat route uses `@ai-sdk/openai`. Set a key in the environment before starting the dev server (PowerShell example):

```powershell
$env:OPENAI_API_KEY = "sk-..."
$env:OPENAI_MODEL = "gpt-4o-mini"
npm run starter
```

Optional: copy `.env.example` to `.env` and load it with your tooling; Vite exposes only variables prefixed with `VITE_` to the client — **do not** put API keys in `VITE_*` variables.

### Production

`vite build` emits static assets only. For production you still need a real `POST /api/chat` (or equivalent) that uses the same Continuum request body and `createContinuumVercelAiSdkRouteHandler` (or the composable server helpers from the adapter README). Deploy that route on your app server or serverless platform.

## See also

- [AI Integration Guide](../../docs/AI_INTEGRATION.md)
- [Integration Guide](../../docs/INTEGRATION_GUIDE.md)
- [`@continuum-dev/vercel-ai-sdk-adapter`](../../packages/vercel-ai-sdk-adapter/README.md)
