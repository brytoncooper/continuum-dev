# AI Integration Guide

How to wire an AI model into Continuum so generated views can evolve safely while user state is preserved.

---

## Recommended Stack

For most teams, the fastest reliable setup is:

- `@continuum-dev/starter-kit` for renderer + chat/workbench primitives
- `@continuum-dev/prompts` for mode-aware prompt assembly and output contracts
- `@continuum-dev/ai-connect` for provider clients and model catalogs

Default provider path:

- OpenAI + Google enabled
- Anthropic optional (only include when explicitly configured)

---

## Integration Model

The model never mutates Continuum state directly. Your app:

1. Generates a candidate `ViewDefinition`
2. Normalizes and validates the payload
3. Runs preflight checks
4. Applies with `session.pushView(view)`
5. Uses `issues` and `resolutions` to decide retry vs accept

```text
model output -> normalize/validate -> session.pushView(view)
                                     |
                                     v
                          @continuum-dev/runtime reconcile
                                     |
                                     v
                     carried/migrated/detached/restored state
```

---

## Baseline Integration (Current APIs)

```typescript
import { createSession } from '@continuum-dev/session';
import { collectDuplicateIssues } from '@continuum-dev/runtime';
import type { ViewDefinition } from '@continuum-dev/contract';

const session = createSession({
  validateOnUpdate: true,
  maxCheckpoints: 50,
});

export function applyModelView(view: ViewDefinition): void {
  if (!view.viewId || !view.version || !Array.isArray(view.nodes)) {
    throw new Error('Invalid view payload: missing viewId/version/nodes');
  }

  const duplicateIssues = collectDuplicateIssues(view.nodes);
  const hasBlockingIssue = duplicateIssues.some((issue) => issue.severity === 'error');
  if (hasBlockingIssue) {
    throw new Error(`Model view rejected: ${duplicateIssues.map((issue) => issue.code).join(', ')}`);
  }

  session.pushView(view);
}
```

If you are using starter-kit UI primitives, `StarterKitProviderChatBox` can run this flow for you and auto-apply valid views to the active session.

---

## Starter-Kit Provider Setup

Use the provider factories exported by `@continuum-dev/starter-kit` when you want each provider configured independently.

```typescript
import {
  createStarterKitAnthropicProvider,
  createStarterKitGoogleProvider,
  createStarterKitOpenAiProvider,
} from '@continuum-dev/starter-kit';

const openAi = createStarterKitOpenAiProvider({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  model: 'gpt-5.4',
});

const gemini = createStarterKitGoogleProvider({
  apiKey: import.meta.env.VITE_GOOGLE_API_KEY,
});

const anthropic = createStarterKitAnthropicProvider({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
});

const providers = [openAi, gemini, anthropic];
```

If you prefer one convenience call, keep using `createStarterKitProviders`:

```typescript
import { createStarterKitProviders } from '@continuum-dev/starter-kit';

const providers = createStarterKitProviders({
  include: ['openai', 'google'],
  openai: {
    apiKey: import.meta.env.VITE_OPENAI_API_KEY,
    model: 'gpt-5.4',
  },
  google: {
    apiKey: import.meta.env.VITE_GOOGLE_API_KEY,
  },
});
```

---

## Prompt Strategy That Holds Up In Production

Use continuity bias, not rigid bans:

- Good: "keep semantic keys stable when meaning is unchanged"
- Bad: "never rename anything under any condition"

Why:

- Over-constrained prompts can block legitimate UX evolution
- Under-constrained prompts increase detached state and mismatches
- Continuum performs best when prompts favor semantic continuity while allowing structural refinement

---

## Prompt Starter Set (Use This)

Use `@continuum-dev/prompts`:

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

Assembly pattern:

1. Base (`system-core`)
2. One mode (`create-view`, `evolve-view`, or `correction-loop`)
3. Optional addons (`attachments`, `strict-continuity`)

Store metadata with each request:

- `promptVersion`
- `mode`
- enabled addons

This gives you repeatable behavior and faster debugging.

Example:

```typescript
import {
  assembleSystemPrompt,
  buildEvolveUserMessage,
  getDefaultOutputContract,
} from '@continuum-dev/prompts';
import { createOpenAiClient } from '@continuum-dev/ai-connect';

const client = createOpenAiClient({
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'gpt-5.4',
});

const systemPrompt = assembleSystemPrompt({
  mode: 'evolve-view',
  addons: ['strict-continuity'],
  outputContract: getDefaultOutputContract(),
});

const userMessage = buildEvolveUserMessage({
  currentView,
  instruction: 'Add co-borrower employment and preserve semantic keys.',
});

const result = await client.generate({
  systemPrompt,
  userMessage,
  outputContract: getDefaultOutputContract(),
});
```

---

## Building Messages For Each Mode

`create-view`:

```typescript
const messages = [
  { role: 'user', content: 'Create a loan intake flow for first-time buyers.' },
];
```

`evolve-view`:

```typescript
const currentView = session.getSnapshot()?.view;
if (!currentView) {
  throw new Error('Cannot evolve view before initial view exists');
}

const messages = [
  {
    role: 'user',
    content: `Current view:\n${JSON.stringify(currentView, null, 2)}\n\nInstruction:\nAdd co-borrower employment details and preserve existing semantic keys.`,
  },
];
```

`correction-loop`:

```typescript
const currentView = session.getSnapshot()?.view;
if (!currentView) {
  throw new Error('Cannot run correction loop without current view');
}

const detachedNodeIds = session
  .getResolutions()
  .filter((resolution) => resolution.resolution === 'detached')
  .map((resolution) => resolution.nodeId);

const runtimeErrors = session
  .getIssues()
  .filter((issue) => issue.severity === 'error')
  .map((issue) => `${issue.code}${issue.nodeId ? `:${issue.nodeId}` : ''}`);

const messages = [
  {
    role: 'user',
    content: [
      `Current view:\n${JSON.stringify(currentView, null, 2)}`,
      `Validation errors:\nnone`,
      `Detached node ids:\n${detachedNodeIds.join(', ') || 'none'}`,
      `Runtime errors:\n${runtimeErrors.join(', ') || 'none'}`,
      'Regenerate a corrected view. Preserve semantic keys for unchanged meaning.',
    ].join('\n\n'),
  },
];
```

---

## Post-Push Audit Loop

After every `pushView`, inspect runtime output and decide whether to retry:

```typescript
session.pushView(viewFromModel);

const issues = session.getIssues();
const resolutions = session.getResolutions();
const diffs = session.getDiffs();

const blockingIssues = issues.filter((issue) => issue.severity === 'error');
const detachedCount = resolutions.filter((resolution) => resolution.resolution === 'detached').length;
```

Recommended policy:

- Retry model generation when validation or runtime errors exist
- Retry when detached count is unexpectedly high
- Accept and continue when issues are warnings only and behavior is expected

For high-volume flows, cap retries (for example, max 2-3 correction attempts) and then surface the latest candidate + issues to the user instead of looping forever.

---

## Proposals Prevent AI Clobbering

When users are mid-edit, stage AI suggestions instead of forcing overwrite:

```typescript
session.proposeValue('email', { value: 'ai_guess@example.com' }, 'ai-agent');

const pending = session.getPendingProposals();
if (pending.email) {
  session.acceptProposal('email');
}
```

Use `rejectProposal` for declines.

---

## Intents And Action Dispatch

Register handlers that can call APIs and update session state in response:

```typescript
session.registerAction('fetch_profile', { label: 'Fetch Profile' }, async (context) => {
  const res = await fetch(`/api/profile?id=${context.snapshot.values['user_id']?.value}`);
  const profile = await res.json();
  context.session.updateState('profile_name', { value: profile.name });
  return { success: true, data: profile };
});
```

Dispatch returns a structured `ActionResult`:

```typescript
const result = await session.dispatchAction('fetch_profile', 'btn_fetch');
if (!result.success) {
  console.error('Action failed:', result.error);
}
```

For an audited lifecycle (submit intent -> dispatch -> validate/cancel), use `executeIntent`:

```typescript
const result = await session.executeIntent({
  nodeId: 'btn_fetch',
  intentName: 'fetch_profile',
  payload: { source: 'ai-agent' },
});
// Intent is now 'validated' on success or 'cancelled' on failure
```

In React, use `useContinuumAction` for dispatch with loading/error state:

```tsx
import { useContinuumAction } from '@continuum-dev/react';

function FetchButton({ definition }: ContinuumNodeProps) {
  const { dispatch, isDispatching, lastResult } = useContinuumAction(definition.intentId);

  return (
    <button disabled={isDispatching} onClick={() => dispatch(definition.id)}>
      {isDispatching ? 'Loading...' : definition.label}
    </button>
  );
}
```

---

## Persistence And Rehydration

Use `hydrateOrCreate` for resilient restart behavior:

```typescript
import { hydrateOrCreate } from '@continuum-dev/session';

const session = hydrateOrCreate({
  persistence: {
    storage: window.localStorage,
    key: 'continuum_session',
    maxBytes: 4_500_000,
    onError: (error) => {
      console.error('Session persistence error', error);
    },
  },
});
```

Current persistence behavior:

- Writes are debounced by 200ms
- Pending writes are flushed on `beforeunload`
- Payload size is guarded by `maxBytes`
- Cross-tab sync uses `storage` events

---

## Provider-Specific Notes

- OpenAI: `createStarterKitOpenAiProvider(...)` is the most direct setup path and keeps OpenAI defaults local to that provider.
- Google Gemini: `createStarterKitGoogleProvider(...)` pairs well with the starter-kit correction retry flow when malformed candidates need repair.
- Anthropic: `createStarterKitAnthropicProvider(...)` keeps Anthropic setup isolated so you can enable it only in environments where keys and model choices are available.

---

## Optional Migration Strategies

Use migration strategies when schema changes require value transformation:

```typescript
const session = createSession({
  reconciliation: {
    migrationStrategies: {
      status: (_nodeId, _priorNode, _newNode, priorValue) => {
        const oldValue = priorValue as { value?: string };
        return { value: (oldValue.value ?? '').toUpperCase() };
      },
    },
  },
});
```

---

## Playground Prompt Note

The playground currently uses a single large system prompt in `apps/playground/src/ai/prompt-builder.ts`.

For shared user guidance, prefer `@continuum-dev/prompts` because it is easier to:

- tune by mode
- add/remove strictness
- run correction loops consistently
- version and audit

---

## Package Status

`@continuum-dev/adapters` and `@continuum-dev/angular` are internal preview packages and are not ready for public production use.

If your model emits a non-Continuum shape, implement a local transform to `ViewDefinition` in your app.

---

## Operational Checklist

1. Keep `viewId` stable per logical workflow.
2. Bump `version` when structure changes.
3. Keep semantic keys stable when meaning is unchanged.
4. Preflight-check output before `pushView`.
5. Inspect `getIssues()` and `getResolutions()` on every push.
6. Run correction-loop retries when errors occur.
7. Use proposals to avoid clobbering user edits.
8. Persist and rehydrate for multi-turn reliability.
