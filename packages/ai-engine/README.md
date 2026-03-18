# @continuum-dev/ai-engine

Headless AI planning, authoring, normalization, and apply helpers for Continuum.

This package contains the transport-agnostic execution engine used by starter-kit wrappers, server routes, and custom integrations.

Use it when you want:

- a shared `state` / `patch` / `view` execution pipeline
- authoring format types, prompt builders, and parsers
- state and patch target catalogs
- normalization, guardrails, and apply helpers
- a reusable final-result apply step for Continuum sessions

## Install

```bash
npm install @continuum-dev/ai-engine
```

## Example

```ts
import {
  applyContinuumExecutionFinalResult,
  buildContinuumExecutionContext,
  type ContinuumViewAuthoringFormat,
  runContinuumExecution,
} from '@continuum-dev/ai-engine';
import { createAiConnectContinuumExecutionAdapter } from '@continuum-dev/ai-connect';

const authoringFormat: ContinuumViewAuthoringFormat = 'line-dsl';

const result = await runContinuumExecution({
  adapter: createAiConnectContinuumExecutionAdapter(provider),
  context: buildContinuumExecutionContext(session),
  instruction: 'Refine the existing intake flow for mobile',
  mode: 'evolve-view',
  authoringFormat,
});

applyContinuumExecutionFinalResult(session, result);
```

`@continuum-dev/ai-engine` does not own provider catalogs, Vercel route helpers, or UI stream transport.
