# AI Connect Quick Start

This package is easiest to understand if you pick a lane first.

## Lane 1: One Provider For `ai-engine`

Use this when `ai-connect` is just your model edge and `ai-engine` owns the Continuum execution flow.

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
  instruction: 'Build a profile form.',
  mode: 'create-view',
  authoringFormat: 'line-dsl',
});
```

Choose this lane when you want the cleanest path into Continuum execution.

## Lane 2: Direct Provider Calls

Use this when you want plain provider access without bringing in `ai-engine`.

```ts
import { createGoogleClient } from '@continuum-dev/ai-connect';

const client = createGoogleClient({
  apiKey: process.env.GOOGLE_API_KEY!,
});

const result = await client.generate({
  systemPrompt: 'Return JSON only.',
  userMessage: 'Describe a profile form.',
});

console.log(result.json ?? result.text);
```

Choose this lane when you already have your own prompt flow and just want typed provider clients.

## Lane 3: Runtime Provider Selection

Use this when the provider is not fixed ahead of time.

```ts
import {
  createAiConnectRegistry,
  createAnthropicClient,
  createOpenAiClient,
} from '@continuum-dev/ai-connect';

const registry = createAiConnectRegistry([
  createOpenAiClient({ apiKey: process.env.OPENAI_API_KEY! }),
  createAnthropicClient({ apiKey: process.env.ANTHROPIC_API_KEY! }),
]);

const result = await registry.generate({
  providerId: 'anthropic',
  request: {
    systemPrompt: 'Return JSON only.',
    userMessage: 'Describe a profile form.',
  },
});
```

Choose this lane when users or settings pick the provider at runtime.

## What The Built-In Clients Already Handle

- direct `fetch` calls to the provider APIs
- provider-specific request shapes
- provider-specific default models
- optional structured-output requests when `outputContract` is present
- one retry without the contract when the provider rejects the schema format itself
- best-effort JSON parsing from returned text

## Three Good Follow-Ups

- Use `createAiConnectProviders(...)` when you want to build a provider list from one config object.
- Use `getAiConnectModelCatalog(...)` when you need a provider-specific model picker.
- Use `createAiConnectContinuumExecutionAdapter(...)` whenever `ai-engine` should own the Continuum execution flow.
