# @continuum-dev/prompts

Prompt templates and assembly helpers for Continuum AI view generation.

## Install

```bash
npm install @continuum-dev/prompts
```

## What this package provides

- A production-ready base system prompt
- Mode prompts for create, evolve, and correction loops
- Optional addons for attachment extraction and strict continuity
- Typed helpers to assemble system prompts and build user messages

## Quick usage

```typescript
import {
  assembleSystemPrompt,
  buildEvolveUserMessage,
  type PromptMode,
} from '@continuum-dev/prompts';

const mode: PromptMode = 'evolve-view';

const systemPrompt = assembleSystemPrompt({
  mode,
  addons: ['strict-continuity'],
});

const userMessage = buildEvolveUserMessage({
  currentView,
  instruction: 'Add co-borrower employment and preserve semantic keys.',
});
```

## Exports

- `PROMPT_LIBRARY_VERSION`
- `PROMPT_LIBRARY`
- `SYSTEM_CORE`
- `MODE_CREATE_VIEW`
- `MODE_EVOLVE_VIEW`
- `MODE_CORRECTION_LOOP`
- `ADDON_ATTACHMENTS`
- `ADDON_STRICT_CONTINUITY`
- `assembleSystemPrompt`
- `buildCreateUserMessage`
- `buildEvolveUserMessage`
- `buildCorrectionUserMessage`
- `getModePrompt`
- `getAddonPrompt`

## Recommended request metadata

Store this with each model request:

- `promptVersion`
- `mode`
- enabled addons list

This makes prompt behavior auditable and easier to tune.
