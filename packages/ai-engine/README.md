# @continuum-dev/ai-engine

`@continuum-dev/ai-engine` is the headless Continuum package that turns a user instruction into Continuum-safe state updates, localized patches, transforms, or full view generation.

## Why This Exists

Continuum needs a place where AI-driven edits can be planned, prompted, parsed, normalized, and checked against runtime continuity rules without being tied to a particular model provider, chat transport, or UI framework. This package is that place. It keeps the execution logic headless so the same engine can sit behind direct provider calls, server routes, or higher-level adapters.

## How It Works

1. You give the engine an `instruction`, an execution adapter that can call a model, and optional Continuum context like `currentView`, `currentData`, detached fields, issues, integrations, actions, and attachments.
2. The open-source runner resolves the execution path in this order: explicit `executionPlan`, else explicit `executionMode`, else the default full-view path.
3. The engine runs the chosen phase with built-in prompts and parsers for that phase.
4. Generated results are runtime-evaluated before acceptance. Invalid or unsafe view-like results may trigger repair or return a `noop`.
5. You get a final result or a stream of execution events. If you have a Continuum session, you can apply the final result back into it.

## What It Is

This package is a headless execution layer with:

- session adapters for bridging a Continuum session into the engine
- execution runners and event streaming
- state-target and patch-target catalogs
- view authoring helpers for `line-dsl`, `yaml`, and `view-json`
- guardrails, patch helpers, and advanced execution subpaths

It is not a model-provider catalog, a route adapter, or a chat UI layer.

## Install

```bash
npm install @continuum-dev/ai-engine
```

If you want a ready-made provider adapter instead of building `ContinuumExecutionAdapter` yourself, also install `@continuum-dev/ai-connect`.

## Easiest Path

The simplest supported path is:

1. wrap your Continuum session with `createContinuumSessionAdapter(...)`,
2. build execution context from that session,
3. run the engine,
4. apply the final result back into the session.

```ts
import {
  applyContinuumExecutionFinalResult,
  buildContinuumExecutionContext,
  createContinuumSessionAdapter,
  runContinuumExecution,
} from '@continuum-dev/ai-engine';
import { createAiConnectContinuumExecutionAdapter } from '@continuum-dev/ai-connect';

const continuumSession = createContinuumSessionAdapter(session);

const result = await runContinuumExecution({
  adapter: createAiConnectContinuumExecutionAdapter(provider),
  instruction: 'Refine the existing intake flow for mobile.',
  // Build the current Continuum execution context from the live session.
  context: buildContinuumExecutionContext(continuumSession),
  // `mode` is prompt authoring mode. Omit `executionMode` to use the open-source default:
  // full view generation.
  mode: 'evolve-view',
  authoringFormat: 'line-dsl',
});

applyContinuumExecutionFinalResult(continuumSession, result);
```

Two important notes:

- `mode` is prompt authoring mode, usually `create-view` or `evolve-view`.
- `executionMode` is actual open-source phase routing: `state`, `patch`, `transform`, or `view`.

If you do not pass `mode`, the engine infers `create-view` when there is no current view and `evolve-view` when there is one.

## Normal Execution Order

1. The engine normalizes context, detached fields, and attachments.
2. It resolves the execution path in this order: `executionPlan`, then `executionMode`, then default full view generation.
3. It infers the authoring prompt mode if you did not supply one.
4. `state` and `patch` can retry once with validation feedback when the first result is weak or unusable.
5. `view` and `transform` results go through runtime continuity evaluation before acceptance.
6. The final result is one of `state`, `patch`, `transform`, `view`, or `noop`.

## Other Options

### Choose the execution lane explicitly

Use `executionMode` when you do not want the default full-view path.

```ts
const result = await runContinuumExecution({
  adapter,
  instruction: 'Add a phone field under email.',
  executionMode: 'patch',
  context: {
    currentView,
    currentData,
  },
});
```

- `executionMode: 'state'` is for value-only updates.
- `executionMode: 'patch'` is for localized structural edits.
- `executionMode: 'transform'` is for surgical schema evolution with transform metadata.
- `executionMode: 'view'` is for explicit full view generation.

### Stream events instead of waiting for the final result

Use `streamContinuumExecution(...)` when you want incremental status, state, patch, or view-preview events.

```ts
for await (const event of streamContinuumExecution({
  adapter,
  instruction,
  context,
  authoringFormat: 'line-dsl',
})) {
  console.log(event.kind);
}
```

### Bring your own execution adapter

You do not need `@continuum-dev/ai-connect`. Implement `ContinuumExecutionAdapter` and pass it to the runner directly.

```ts
import type {
  ContinuumExecutionAdapter,
  ContinuumExecutionRequest,
  ContinuumExecutionResponse,
} from '@continuum-dev/ai-engine';

const adapter: ContinuumExecutionAdapter = {
  label: 'my-provider',
  async generate(
    request: ContinuumExecutionRequest
  ): Promise<ContinuumExecutionResponse> {
    const text = await callYourModel({
      system: request.systemPrompt,
      user: request.userMessage,
    });
    return { text };
  },
};
```

### Use pieces without the full runner

Examples:

- `buildContinuumStateTargetCatalog(...)`
- `buildContinuumPatchTargetCatalog(...)`
- `parseContinuumStateResponse(...)`
- `parseViewAuthoringToViewDefinition(...)`
- `normalizeViewDefinition(...)`
- `buildPatchSystemPrompt(...)`
- `buildPatchUserMessage(...)`
- `normalizeViewPatchPlan(...)`

### Advanced subpaths

- `@continuum-dev/ai-engine/continuum-execution` exposes low-level shared planner helpers like `parseJson(...)` and semantic identity normalization.
- `@continuum-dev/ai-engine/execution-stream` exposes phase runners and stream-environment construction for advanced composition.

The open-source package does not ship the private premium planner. If a private package wants planner-led routing, it can compose on top of these subpaths.

## Dictionary Contract

### Core literals

- `executionMode`: `'state' | 'patch' | 'transform' | 'view'`
- `ContinuumExecutionPhase`: `'planner' | 'state' | 'patch' | 'transform' | 'view' | 'repair'`
- `ContinuumExecutionOutputKind`: `'text' | 'json-object'`
- `ContinuumViewAuthoringFormat`: `'line-dsl' | 'yaml' | 'view-json'`
- `ContinuumExecutionStatusLevel`: `'info' | 'success' | 'warning' | 'error'`
- `ContinuumChatAttachment.kind`: `'image' | 'file'`

### Final result modes

- `state`
- `patch`
- `transform`
- `view`
- `noop`

### Stream event kinds

- `status`
- `state`
- `patch`
- `view-preview`
- `view-final`
- `error`

### Resolved-plan validation values

- `accepted`
- `invalid-plan`
- `state-unavailable`
- `patch-unavailable`
- `transform-unavailable`
- `unknown-targets`
- `missing-targets`
- `partial-targets`

### Resolved-plan integration validation values

- `accepted`
- `missing-endpoint`
- `invalid-endpoint`
- `missing-payload-keys`
- `partial-payload-keys`
- `not-applicable`

### Common execution context fields

- `currentView`
- `currentData`
- `detachedFields`
- `conversationSummary`
- `issues`
- `integrationCatalog`
- `registeredActions`
- `chatAttachments`

### Structured-output note

- `outputKind` is only a hint about the expected response shape.
- `outputContract` is the real structured-output contract when the transport supports it.
- `view-json` uses the built-in `ViewDefinition` output contract and does not stream incremental text previews.

## Source Notes

- [`src/lib/ARCHITECTURE.md`](src/lib/ARCHITECTURE.md) maps the internal areas and their responsibilities.
- [`src/README.md`](src/README.md) is the internal entry note when you are browsing the package source.
