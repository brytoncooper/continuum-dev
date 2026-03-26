# @continuum-dev/ai-connect

`@continuum-dev/ai-connect` is the headless provider layer for Continuum AI workflows.

## Why This Exists

Continuum needs a place for provider-specific model calls that is separate from session, rendering, execution behavior, and transport. `ai-connect` exists so the rest of the stack can talk to OpenAI, Anthropic, or Google through a small headless contract instead of embedding provider API details everywhere.

## How It Works

1. A client like `createOpenAiClient(...)` or `createGoogleClient(...)` turns a `systemPrompt`, `userMessage`, and optional structured-output contract into a provider request.
2. The client returns `text`, parsed `json` when possible, the raw provider response, and metadata like `providerId`, `model`, and optional `outputContractFallbackUsed`.
3. `createAiConnectRegistry(...)` lets you choose a provider by id at call time.
4. `createAiConnectContinuumExecutionAdapter(...)` turns any ai-connect client into a `ContinuumExecutionAdapter` for `@continuum-dev/ai-engine`.

## What It Is

This package is a headless provider and registry layer with:

- direct clients for OpenAI, Anthropic, and Google
- registry and provider-composer helpers
- a published model catalog
- an adapter from ai-connect clients into ai-engine

It is not a route adapter, a planner, a chat UI, or a session layer.

## Install

```bash
npm install @continuum-dev/ai-connect
```

The built-in clients use `fetch` directly, so you do not need separate provider SDK packages just to use this package.

## Easiest Path

The easiest path is to create one provider client and wrap it for `@continuum-dev/ai-engine`.

```ts
import {
  createAiConnectContinuumExecutionAdapter,
  createOpenAiClient,
} from '@continuum-dev/ai-connect';
import { runContinuumExecution } from '@continuum-dev/ai-engine';

const client = createOpenAiClient({
  apiKey: process.env.OPENAI_API_KEY!,
});

const adapter = createAiConnectContinuumExecutionAdapter(client);

const result = await runContinuumExecution({
  adapter,
  instruction: 'Build a loan intake form.',
  // `mode` is prompt authoring mode.
  mode: 'create-view',
  authoringFormat: 'line-dsl',
});
```

That is the fastest path when `ai-connect` is just your model edge and `ai-engine` owns the Continuum execution logic.

Need lane-by-lane examples? See [QUICK_START.md](./QUICK_START.md).

## Normal Request Order

1. You create a client, a registry, or a provider list.
2. You call `generate(...)` directly or through the registry, or you wrap the client for `ai-engine`.
3. If `outputContract` is present, the built-in clients ask the provider for structured output.
4. If the provider rejects the schema format itself, the built-in clients retry once without the contract and still try to parse JSON from the returned text.
5. The final result always includes `text` and may include parsed `json` plus `outputContractFallbackUsed`.

## Other Options

### Call a provider directly

Use a client directly when you want plain model access without `ai-engine`.

```ts
import { createGoogleClient } from '@continuum-dev/ai-connect';

const client = createGoogleClient({
  apiKey: process.env.GOOGLE_API_KEY!,
});

const result = await client.generate({
  systemPrompt: 'Return JSON only.',
  userMessage: 'Describe a profile form.',
});
```

### Use a registry for runtime provider selection

```ts
import {
  createAiConnectRegistry,
  createGoogleClient,
  createOpenAiClient,
} from '@continuum-dev/ai-connect';

const registry = createAiConnectRegistry([
  createOpenAiClient({ apiKey: process.env.OPENAI_API_KEY! }),
  createGoogleClient({ apiKey: process.env.GOOGLE_API_KEY! }),
]);

const result = await registry.generate({
  providerId: 'openai',
  request: {
    systemPrompt: 'Return JSON only.',
    userMessage: 'Describe a profile form.',
  },
});
```

### Compose providers from one config object

Use `createAiConnectProviders(...)` when you want a quick list of built-in providers with defaults and overrides.

### Use the published model catalog

Use `getAiConnectModelCatalog(...)` or `AI_CONNECT_MODEL_CATALOG` when you need a provider-specific model picker.

## Dictionary Contract

### Provider kinds

- `openai`
- `anthropic`
- `google`

### `AiConnectGenerateRequest`

- `systemPrompt`
- `userMessage`
- `outputContract?`
- `model?`
- `temperature?`
- `maxTokens?`

### `AiConnectGenerateResult`

- `providerId`
- `model`
- `text`
- `json`
- `raw`
- `outputContractFallbackUsed?`

### Built-in client defaults

- `createOpenAiClient(...)`
  Default `id`: `openai`
  Default `label`: `OpenAI`
  Default model: `gpt-5.4`
- `createAnthropicClient(...)`
  Default `id`: `anthropic`
  Default `label`: `Anthropic`
  Default model: `claude-sonnet-4-6`
- `createGoogleClient(...)`
  Default `id`: `google`
  Default `label`: `Google Gemini`
  Default model: `gemini-2.5-flash`

### Structured-output note

- Built-in clients advertise `supportsJsonSchema: true`.
- When `outputContract` is present, they ask the provider for structured output.
- On schema-format rejection only, they retry once without the contract and set `outputContractFallbackUsed: true`.

## Related Docs

- [Quick Start](./QUICK_START.md)
- [AI Engine README](../ai-engine/README.md)
- [AI Integration Guide](../../docs/AI_INTEGRATION.md)
