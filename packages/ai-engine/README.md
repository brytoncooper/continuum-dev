# @continuum-dev/ai-engine

Headless AI planning, authoring, normalization, and apply helpers for Continuum.

This package contains the shared AI engine used by starter-kit wrappers, server routes, and custom integrations.

Use it when you want:

- execution planning helpers
- authoring format types
- prompt builders and parsers
- state and patch target catalogs
- normalization, guardrails, and apply helpers

## Install

```bash
npm install @continuum-dev/ai-engine
```

## Example

```ts
import {
  runContinuumViewGeneration,
  type ContinuumViewAuthoringFormat,
} from '@continuum-dev/ai-engine';

const authoringFormat: ContinuumViewAuthoringFormat = 'line-dsl';

const result = await runContinuumViewGeneration({
  provider,
  session,
  instruction: 'Refine the existing intake flow for mobile',
  mode: 'evolve-view',
  authoringFormat,
  autoApplyView: true,
});
```

The package also keeps starter-kit-specific aliases for teams migrating older integrations.
