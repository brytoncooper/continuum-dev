# AI Integration Guide

How to wire AI into Continuum without losing the layering:

- `@continuum-dev/react` and `@continuum-dev/session` for the renderable runtime state
- `@continuum-dev/ai-engine` for headless planning, authoring, parsing, normalization, and apply helpers
- `@continuum-dev/vercel-ai-sdk-adapter` for the Vercel AI SDK transport path
- `@continuum-dev/ai-connect` for built-in provider factories and model catalogs
- `@continuum-dev/starter-kit-ai` for optional thin starter-oriented chat wrappers
- `@continuum-dev/ai-core` only when you explicitly want a convenience facade after you understand the stack

The public story should stay simple:

- learn the system from the explicit layers
- use thin wrappers only when they genuinely reduce work
- treat convenience facades as package ergonomics, not as the architecture itself

## The core principle

The model should author **view changes**, not mutate Continuum session internals directly.

The safest loop looks like this:

```text
instruction
  -> execution planning
  -> patch or state mode when safe
  -> otherwise full authoring output
  -> parse into ViewDefinition or typed updates
  -> normalize and validate
  -> repair once when malformed
  -> apply into the active session
```

## Responsibilities by package

### `@continuum-dev/react` and `@continuum-dev/session`

Use these packages when you need the live Continuum session that views, diagnostics, streams, and user edits flow through. For serious custom integrations, this is the clearest runtime surface to pair with AI execution.

### `@continuum-dev/ai-engine`

Use this package when you want the shared headless contract:

- execution planning helpers
- authoring format types
- prompt builders and parsers
- patch and state target catalogs
- normalization, guardrails, and apply helpers

### `@continuum-dev/vercel-ai-sdk-adapter`

Use this package when Vercel AI SDK is your transport layer. It owns:

- client-side session/message application
- request-body helpers for `currentView` and `currentData`
- server-side writer helpers that emit Continuum `data-*` parts into AI SDK UI streams

It should not own prompt policy, repair policy, auth, storage, tools, or your main AI SDK route architecture.

### `@continuum-dev/ai-connect`

Use this package when you want provider factories, registry helpers, or model catalogs without tying them to a specific UI.

### `@continuum-dev/starter-kit-ai`

Use this package only when you already want `starter-kit` and you want thin chat wrappers such as `StarterKitProviderChatBox` or `StarterKitVercelAiSdkChatBox`.

### `@continuum-dev/ai-core`

Use this package when a single dependency edge is more valuable to you than learning the leaf packages directly. It is a convenience facade, not the recommended place to learn the architecture.

## The preferred authoring formats

`ai-engine` supports:

- `line-dsl`
- `yaml`

If you do nothing, the shared engine defaults to:

```ts
const authoringFormat = 'line-dsl';
```

`line-dsl` is the default because it gives the model a smaller, more opinionated shape to produce than raw JSON. YAML is still supported, but it is the alternate authoring format, not the default mental model.

## The authoring principles

These are the ideas the shared engine teaches the model:

- return only Continuum authoring output, not prose
- prefer patching existing views over replacing whole workflows
- preserve semantic continuity when meaning is unchanged
- use stable semantic metadata when continuity matters
- preserve existing node types and section structure unless the instruction truly requires change
- use `defaultValue` and `defaultValues` for prefilling instead of reshaping layout
- treat detached fields as recoverable continuity hints, not disposable history
- prefer simple, valid structures over ambitious, brittle ones

### `line-dsl` shape

Example:

```text
view viewId="patient_checkin" version="2"
group id="checkin" label="Urgent Care Check-In"
  field id="full_name" key="full_name" label="Full name" dataType="string"
  row id="contact_row"
    field id="phone" key="phone" label="Phone" dataType="string"
    date id="birth_date" key="birth_date" label="Date of birth"
  action id="submit_checkin" intentId="submit_checkin.submit" label="Submit"
```

## Patch mode is part of the philosophy

For small changes, `ai-engine` does not always jump straight to full regeneration.

Patch mode exists to make safe incremental evolution easier:

- prefer patch mode when updating existing node props
- prefer local container patches for layout tweaks
- switch to full mode when patching is unsafe or the workflow is truly changing
- preserve semantic continuity and detached continuity during patch decisions

## Using the headless engine directly

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

## Provider-backed starter lane

If you want the fewest moving parts for hosted providers, compose `ai-connect`, `starter-kit-ai`, and the slim starter preset:

```tsx
import {
  createAiConnectProviders,
  getAiConnectModelCatalog,
  StarterKitProviderChatBox,
} from '@continuum-dev/starter-kit-ai';

const providers = createAiConnectProviders({
  include: ['openai', 'google'],
  openai: {
    apiKey: import.meta.env.VITE_OPENAI_API_KEY,
    model: 'gpt-5',
  },
  google: {
    apiKey: import.meta.env.VITE_GOOGLE_API_KEY,
  },
});

const models = getAiConnectModelCatalog(providers);

export function AiControls() {
  return (
    <>
      <StarterKitProviderChatBox
        providers={providers}
        models={models}
        mode="evolve-view"
        authoringFormat="line-dsl"
      />
    </>
  );
}
```

## Vercel AI SDK lane

If Vercel AI SDK is your transport, keep the transport and swap in Continuum as the runtime that consumes typed stream parts.

```tsx
import { DefaultChatTransport } from 'ai';
import { StarterKitVercelAiSdkChatBox } from '@continuum-dev/starter-kit-ai';

export function VercelLane() {
  return (
    <StarterKitVercelAiSdkChatBox
      chatOptions={{
        transport: new DefaultChatTransport({
          api: '/api/chat',
        }),
      }}
    />
  );
}
```

Or drop lower and use the raw hook with the explicit packages:

```tsx
import { DefaultChatTransport } from 'ai';
import { useContinuumSession } from '@continuum-dev/react';
import {
  buildContinuumVercelAiSdkRequestBody,
  useContinuumVercelAiSdkChat,
} from '@continuum-dev/vercel-ai-sdk-adapter';

export function CustomChat() {
  const session = useContinuumSession();
  const chat = useContinuumVercelAiSdkChat({
    session,
    transport: new DefaultChatTransport({
      api: '/api/chat',
      body: () =>
        buildContinuumVercelAiSdkRequestBody({
          currentView: session.getSnapshot()?.view ?? null,
          currentData: session.getSnapshot()?.data.values ?? null,
        }),
    }),
  });

  return (
    <button
      onClick={() => chat.sendMessage({ text: 'Add a co-applicant section' })}
    >
      Send prompt
    </button>
  );
}
```

If you prefer one dependency edge after you understand the stack, `@continuum-dev/ai-core` re-exports the same headless path.

Composable server route:

```ts
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
} from 'ai';
import { openai } from '@ai-sdk/openai';
import {
  createVercelAiSdkContinuumExecutionAdapter,
  writeContinuumExecutionToUiMessageWriter,
} from '@continuum-dev/vercel-ai-sdk-adapter/server';

export async function POST(request: Request) {
  const body = await request.json();
  const model = openai('gpt-5');
  const result = streamText({
    model,
    messages: convertToModelMessages(body.messages),
  });

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      writer.merge(result.toUIMessageStream());
      await writeContinuumExecutionToUiMessageWriter({
        writer,
        adapter: createVercelAiSdkContinuumExecutionAdapter({ model }),
        instruction: body.continuum?.instruction,
        context: {
          currentView: body.currentView,
          currentData: body.currentData,
        },
      });
    },
  });

  return createUIMessageStreamResponse({ stream });
}
```

## Prompting guidance that matches the engine

Good instructions:

- "Add a co-applicant section while preserving existing semantic keys."
- "Refine layout for mobile but keep the same workflow."
- "Prefill this form with the provided patient data."
- "Bring back the allergy field in the medications section."

Less helpful instructions:

- "Rebuild this whole thing from scratch."
- "Change everything but keep all state."
- "Rename whatever you want."

## Correction loops should still be format-first

When a candidate is malformed, the repair path should still follow the same authoring principles.

The correction loop feeds the model:

- the current view
- detached field hints
- validation errors
- runtime errors

And asks for:

- a corrected next view
- preserved unchanged semantics
- valid authoring output in the same format

## Audit after every apply

Even with strong authoring guidance, every generated view should still be audited after apply:

```ts
const issues = session.getIssues();
const resolutions = session.getResolutions();
const diffs = session.getDiffs();
```

Recommended policy:

- retry when validation or runtime errors exist
- retry when detached count is unexpectedly high
- accept when only expected warnings remain

## AI shipping checklist

1. Keep `starter-kit` slim and free of provider or planner logic.
2. Put planning, parsing, normalization, and apply behavior in `ai-engine`.
3. Put provider factories and model catalogs in `ai-connect`.
4. Use `starter-kit-ai` only for thin UI wrappers.
5. Keep Vercel AI SDK transport-only.
   Continuum-specific request and writer helpers belong in `@continuum-dev/vercel-ai-sdk-adapter`.
6. Patch when a local incremental change is safe.
7. Only fall back to full regeneration when patching is unsafe or the workflow truly changes.
8. Inspect issues and resolutions after every AI-generated apply.

## Related guides

- [Quick Start](./QUICK_START.md)
- [Integration Guide](./INTEGRATION_GUIDE.md)
- [View Contract Reference](./VIEW_CONTRACT.md)

Reference app walkthroughs and migration guides live in the private Continuum documentation repository.
