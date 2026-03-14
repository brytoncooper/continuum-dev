# demo-api

Cloudflare Worker app for the public Continuum demo.

This app is intentionally separate from `apps/demo`:

- `apps/demo` is the frontend SPA
- `apps/demo-api` is the Worker/API surface

That separation is important because Continuum reconciliation stays in the browser.
The server streams model output and Continuum data parts, but the live session and
reconciliation engine remain client-side.

Planned modes:

- `mock`: deterministic demo route with no provider key required
- `live`: real provider-backed route using either Worker secrets or BYOK

Current routes:

- `POST /api/vercel-ai-sdk/demo`: deterministic mock stream
- `POST /api/vercel-ai-sdk/chat`: live Vercel AI SDK stream
- `GET /api/vercel-ai-sdk/providers`: provider metadata plus whether Worker secrets are configured
