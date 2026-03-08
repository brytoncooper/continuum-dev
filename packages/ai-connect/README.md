# @continuum-dev/ai-connect

Website: [continuumstack.dev](https://continuumstack.dev)
GitHub: [brytoncooper/continuum-dev](https://github.com/brytoncooper/continuum-dev)

Headless provider connection clients for Continuum AI workflows.

This package is intentionally headless. It does not render UI and can be used from React, Angular, or server utilities.

## Install

```bash
npm install @continuum-dev/ai-connect
```

## What this package provides

- Typed provider clients for OpenAI and Google Gemini (Anthropic is optional when explicitly enabled)
- Optional JSON-schema response enforcement for providers that support it
- A provider registry utility for multi-provider selection and dispatch

## Quick usage

```ts
import {
  createAiConnectRegistry,
  createOpenAiClient,
  createGoogleClient,
} from '@continuum-dev/ai-connect';
import {
  assembleSystemPrompt,
  buildCreateUserMessage,
  getDefaultOutputContract,
} from '@continuum-dev/prompts';

const registry = createAiConnectRegistry([
  createOpenAiClient({ apiKey: process.env.OPENAI_API_KEY! }),
  createGoogleClient({ apiKey: process.env.GOOGLE_API_KEY! }),
]);

const result = await registry.generate({
  providerId: 'openai',
  request: {
    systemPrompt: assembleSystemPrompt({ mode: 'create-view' }),
    userMessage: buildCreateUserMessage('Build a loan intake form'),
    outputContract: getDefaultOutputContract(),
  },
});

console.log(result.json ?? result.text);
```
