# AI Integration Guide

How to wire AI into Continuum using the starter kit’s actual authoring contract.

This guide is intentionally **DSL-first**. The starter kit’s preferred path is not “ask the model for raw JSON and hope it is valid.” The preferred path is:

1. patch the current view when a small safe change is possible
2. otherwise generate a full next view in Continuum authoring format
3. parse and normalize that output into a `ViewDefinition`
4. repair once when the candidate is malformed
5. apply the normalized view to the active session

## The core principle

The model should author **view changes**, not mutate Continuum state directly.

The safest loop looks like this:

```text
instruction
  -> patch plan when safe
  -> otherwise full authoring output
  -> parse into ViewDefinition
  -> normalize and validate
  -> repair if malformed
  -> session.applyView(...)
```

That is how the starter kit preserves user intent while still letting AI reshape the UI.

## The preferred authoring format

The starter kit defaults to `line-dsl`.

`line-dsl` is the default because it gives the model a smaller, more opinionated shape to produce than raw JSON. YAML is still supported, but it is an alternate authoring format, not the default mental model.

Authoring formats supported by the starter kit:

- `line-dsl`
- `yaml`

If you do nothing, the starter kit uses:

```ts
authoringFormat: 'line-dsl'
```

## The DSL principles

These are the actual ideas the starter kit teaches the model:

- return only Continuum authoring output, not prose
- prefer patching existing views over replacing whole workflows
- preserve semantic continuity when meaning is unchanged
- use `key` when continuity matters
- preserve existing node types and section structure unless the instruction truly requires change
- use `defaultValue` and `defaultValues` for prefilling instead of reshaping layout
- treat detached fields as recoverable continuity hints, not as disposable history
- prefer simple, valid structures over ambitious, brittle ones

### `line-dsl` shape

The system prompt for `line-dsl` teaches rules like:

- return only Continuum View DSL
- do not return JSON
- do not return markdown fences
- use exactly two spaces for each indentation level
- write one root line: `view viewId="..." version="..."`
- write one line per node
- include `id="..."` on every node
- use `key="..."` when semantic continuity matters

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

### Continuity rules the DSL reinforces

The DSL path is not just syntactic. It encodes Continuum’s continuity model:

- use `key` for stable semantics
- if meaning is unchanged, preserve keys and usually preserve node types
- evolve existing views instead of replacing them wholesale
- if the user says “prefill,” add defaults instead of redesigning the form
- if a detached field is being reintroduced, reuse its `detachedKey` as the new node `key`
- never reuse a detached key for a different concept just because the value preview looks similar

## Layout principles built into the authoring contract

The starter kit’s prompts also teach layout choices, not just schema validity:

- use `group` for major sections and semantic clusters
- use `row` for two or three short related fields
- use `grid` for compact peer fields or scannable card-like items
- prefer vertical stacking for dense or mobile-sensitive workflows
- use `collection` only for repeatable user-managed items
- keep collection templates compact
- use `presentation` sparingly for orientation and summaries
- prefer one clear primary action near the end
- avoid deep nesting and unnecessary containers

This matters because the DSL is trying to produce good Continuum views, not just technically parseable ones.

## Collection and prefill principles

The authoring path has specific rules for collections:

- if you create or keep a collection, give it at least one initial item with `defaultValues` unless the user explicitly wants an empty collection
- when prefilling a collection, put `defaultValues` on the collection node
- do not use `defaultValue` on template fields when the goal is to prefill collection items

Example:

```text
collection id="medications" key="medications" label="Current medications" defaultValues="[{\"medication_name\":\"Lisinopril\"}]"
  group id="medication_item" label="Medication"
    field id="medication_name" key="medication_name" label="Medication name" dataType="string"
```

## How the starter kit actually runs generation

The starter kit view generation engine follows this rough policy:

1. if patch mode is safe, ask for a patch plan
2. if patching is unsafe or ambiguous, run full authoring generation
3. parse the authored output into a `ViewDefinition`
4. normalize ids and fill missing safe defaults where needed
5. reject unsupported node types and structural errors
6. run one repair pass in correction mode when the candidate is malformed
7. auto-apply the final normalized view when enabled

Important behavior:

- patch mode is preferred for small evolve-view changes
- full generation defaults to `line-dsl`
- correction-loop uses the same authoring format and feeds validation/runtime errors back in
- unsupported node types and malformed structures are rejected before apply

## Patch mode is part of the philosophy

For small changes, the starter kit does not always jump straight to full regeneration.

Patch mode exists to make safe incremental evolution easier:

- prefer patch mode when updating existing node props
- prefer local container patches for layout tweaks
- switch to full mode when patching is unsafe or the workflow is truly changing
- preserve semantic continuity and detached-key continuity during patch decisions

This matches the broader Continuum idea: evolve with the least destructive change that still satisfies the instruction.

## Recommended provider setup

If you want the fewest moving parts, configure providers from `@continuum-dev/starter-kit`:

```ts
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

If you prefer one convenience call:

```ts
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

Practical guidance:

- start with OpenAI and Google
- treat Anthropic as optional
- use `line-dsl` as the default authoring format unless you have a strong reason to prefer YAML

## Use the starter kit’s built-in AI surface

If you are already on the starter kit, the easiest integration is the built-in chat primitive.

```tsx
import {
  type AiConnectClient,
  StarterKitProviderChatBox,
  StarterKitSessionWorkbench,
  type StarterKitViewAuthoringFormat,
} from '@continuum-dev/starter-kit';

const authoringFormat: StarterKitViewAuthoringFormat = 'line-dsl';

export function AiControls({ providers }: { providers: AiConnectClient[] }) {
  return (
    <>
      <StarterKitProviderChatBox
        providers={providers}
        mode="evolve-view"
        authoringFormat={authoringFormat}
      />
      <StarterKitSessionWorkbench />
    </>
  );
}
```

For most apps:

- use `mode="evolve-view"`
- keep `authoringFormat="line-dsl"`
- let the session workbench surface checkpoint and rewind controls

## Prompting guidance that matches the DSL

When writing user instructions, match the same principles the DSL system prompt is already enforcing.

Good instructions:

- “Add a co-applicant section while preserving existing semantic keys.”
- “Refine layout for mobile but keep the same workflow.”
- “Prefill this form with the provided patient data.”
- “Bring back the allergy field in the medications section.”

Why these work:

- they ask for evolution, not replacement
- they preserve semantics where possible
- they distinguish structural change from prefilling
- they make restoration requests explicit

Less helpful instructions:

- “Rebuild this whole thing from scratch.”
- “Change everything but keep all state.”
- “Rename whatever you want.”

## Correction-loop should still be DSL-first

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

That means repair is not a different philosophy. It is the same DSL contract applied with stronger error context.

## Detached fields are first-class continuity signals

One of the most important Continuum-specific ideas in the DSL path is detached-field continuity.

Detached fields are previous fields whose user data can still be restored.

When the user asks to bring something back:

- use `previousLabel` and `previousParentLabel` as semantic clues
- if it is the same field returning, reuse the `detachedKey`
- do not recycle that detached key for a different concept

This is a big part of what makes the starter kit’s AI integration feel like Continuum instead of just “AI form generation.”

## Audit after every apply

Even with DSL guidance, every generated view should still be audited after apply:

```ts
const issues = session.getIssues();
const resolutions = session.getResolutions();
const diffs = session.getDiffs();

const blockingIssues = issues.filter((issue) => issue.severity === 'error');
const detachedCount = resolutions.filter(
  (resolution) => resolution.resolution === 'detached'
).length;
```

Recommended policy:

- retry when validation or runtime errors exist
- retry when detached count is unexpectedly high
- accept when only expected warnings remain

Cap retries. A small bounded repair loop is better than infinite regeneration.

## Persistence still matters

For long-running AI workflows, persistence is still essential.

Use `hydrateOrCreate` if you want explicit lifecycle control:

```ts
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

- writes are debounced
- pending writes are flushed on unload
- payload size is guarded by `maxBytes`
- cross-tab sync uses `storage` events

## DSL-first checklist

Use this checklist before shipping starter-kit AI generation:

1. Default to `line-dsl`.
2. Patch when a local incremental change is safe.
3. Only fall back to full regeneration when patching is unsafe or the workflow is truly changing.
4. Preserve semantic keys and node types when meaning is unchanged.
5. Use `defaultValue` and `defaultValues` for prefill requests.
6. Reuse detached keys only when restoring the same semantic field.
7. Keep layouts simple, intentional, and easy to scan.
8. Normalize, validate, and repair once before apply.
9. Inspect issues and resolutions after every AI-generated apply.

## Related guides

- [Quick Start](./QUICK_START.md)
- [Integration Guide](./INTEGRATION_GUIDE.md)
- [View Contract Reference](./VIEW_CONTRACT.md)
