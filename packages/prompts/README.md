# @continuum-dev/prompts

Website: [continuumstack.dev](https://continuumstack.dev)
GitHub: [brytoncooper/continuum-dev](https://github.com/brytoncooper/continuum-dev)

## Core Premise: The Ephemerality Gap

The Ephemerality Gap is the mismatch between ephemeral, regenerating interfaces and durable user intent.
Continuum keeps UI structure and user state separate, then uses deterministic reconciliation so user intent survives schema changes.

Prompt templates and assembly helpers for Continuum AI view generation.

If you want the opinionated UI layer and prompt helpers from one install path, `@continuum-dev/starter-kit` re-exports this package.

## Install

```bash
npm install @continuum-dev/prompts
```

## What this package provides

- A production-ready base system prompt
- Mode prompts for create, evolve, and correction loops
- Optional addons for attachment extraction and strict continuity
- A default JSON schema output contract for `ViewDefinition`
- Typed helpers to assemble system prompts and build user messages

## Quick usage

```typescript
import {
  assembleSystemPrompt,
  buildEvolveUserMessage,
  getDefaultOutputContract,
  type PromptMode,
} from '@continuum-dev/prompts';

const mode: PromptMode = 'evolve-view';

const systemPrompt = assembleSystemPrompt({
  mode,
  addons: ['strict-continuity'],
  outputContract: getDefaultOutputContract(),
});

const userMessage = buildEvolveUserMessage({
  currentView,
  instruction: 'Add co-borrower employment and preserve semantic keys.',
});
```

## Output contract helpers

- `VIEW_DEFINITION_RESPONSE_SCHEMA`: default JSON schema for Continuum `ViewDefinition`
- `VIEW_DEFINITION_OUTPUT_CONTRACT`: named default contract object
- `buildOutputContractInstructions`: renders explicit schema instructions for system prompts
- `getDefaultOutputContract`: returns the default contract from `PROMPT_LIBRARY`

## Exports

- `PROMPT_LIBRARY_VERSION`
- `PROMPT_LIBRARY`
- `SYSTEM_CORE`
- `MODE_CREATE_VIEW`
- `MODE_EVOLVE_VIEW`
- `MODE_CORRECTION_LOOP`
- `ADDON_ATTACHMENTS`
- `ADDON_STRICT_CONTINUITY`
- `VIEW_DEFINITION_RESPONSE_SCHEMA`
- `VIEW_DEFINITION_OUTPUT_CONTRACT`
- `assembleSystemPrompt`
- `buildCreateUserMessage`
- `buildEvolveUserMessage`
- `buildCorrectionUserMessage`
- `buildOutputContractInstructions`
- `getDefaultOutputContract`
- `getModePrompt`
- `getAddonPrompt`

## Recommended request metadata

Store this with each model request:

- `promptVersion`
- `mode`
- enabled addons list
- output contract name/version

This makes prompt behavior auditable and easier to tune.
