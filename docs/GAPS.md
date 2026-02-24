# Current Limitations

**Last audited:** 2026-02-22

This document catalogs what Continuum can and can't do today. It is a living document -- gaps are marked `OPEN`, `IN PROGRESS`, or `CLOSED` as work progresses.

---

## 1. Will Break Your Integration

These are things that are missing or broken in ways that would block a real-world use case.

---

**No default values for new components** `OPEN`

When the AI adds a new field to the schema, its state starts as `undefined`. There is no way for the schema to declare "this field should start with the value X." Every new field renders blank, even if the AI intended an initial value.

*When this matters:* Any time the AI generates a field with a sensible default (e.g., a country selector that should default to "US").

---

**No validation or constraints** `OPEN`

The schema can't express "this field is required," "this number must be between 1 and 100," or "this field must be a valid email." There is no min, max, pattern, or required flag. The `stateShape` field exists on the contract type but is never read by anything.

*When this matters:* Any form that needs input validation before submission.

---

**No presentation metadata** `OPEN`

Components have no `label`, `placeholder`, `description`, `disabled`, `readOnly`, or `hidden` fields. The renderer falls back to showing the field's raw ID as its display name. The AI can't say "this field should be labeled 'Email Address'" -- it just shows "email."

*When this matters:* Any user-facing UI. Without labels and placeholders, the generated form looks like a developer debug tool.

---

**No custom props from schema to components** `OPEN`

A select/dropdown component can't receive its options from the schema. The options are hardcoded in the component implementation. This means the AI can't define what a dropdown's choices are -- every select shows the same "Option A / Option B / Option C" regardless of what the AI intended.

*When this matters:* Any dynamic form with dropdowns, radio groups, or any component that needs configuration beyond a type name.

---

**Session doesn't forward reconciliation options** `OPEN`

The reconciler supports configuration like custom migration strategies, a strategy registry, and flags like `allowBlindCarry`. But the session never passes these through when it calls the reconciler. A developer using the session API has no way to configure how reconciliation behaves.

*Workaround:* Call the `reconcile` function from `@continuum/runtime` directly, bypassing the session. This loses all session lifecycle benefits (checkpoints, persistence, listeners).

---

**No input validation on deserialize** `OPEN`

When a session is restored from localStorage, the deserialized data is trusted without any validation. Corrupt data, a different app's data in the same storage key, or manually tampered data can produce a broken session that will throw errors later with no clear cause.

*When this matters:* Any production deployment where localStorage is shared or users have dev tools access.

---

**No error boundary on rendered components** `OPEN`

If a single component in the schema throws a rendering error (bad data, missing prop, component bug), the entire form crashes. There is no error boundary wrapping individual components, so one bad field takes down the whole UI.

*Workaround:* Wrap your own component implementations in try/catch or React error boundaries.

---

**No cross-tab synchronization** `OPEN`

If a user opens the same app in two browser tabs, both tabs write to the same localStorage key. They don't detect each other's changes. Whichever tab writes last wins, silently overwriting the other tab's state.

*When this matters:* Any web app where users might have multiple tabs open.

---

**recordIntent accepts nonexistent component IDs** `OPEN`

You can call `session.updateState('doesnt_exist', { value: 'hello' })` and the session will happily store state for a component ID that isn't in the current schema. No warning, no error. This state pollutes the snapshot and survives serialization.

*When this matters:* Any integration where the calling code might have a typo or stale reference to a component ID.

---

**Dead schema fields** `OPEN`

`ComponentDefinition` declares `stateType`, `stateShape`, and `path` fields, but nothing in the system reads them. A developer might set these expecting validation or behavior and get nothing. They exist in the type definitions but are completely inert.

---

**Interaction type is unvalidated** `OPEN`

The `type` field on recorded interactions (the event log) is a plain string with no enum or validation. Any typo passes silently. There's no way to query "all value-change events" reliably if the calling code misspells the type.

---

**'modified' diff type is never emitted** `OPEN`

The constant `DIFF_TYPES.MODIFIED` exists and is exported, but the reconciler never produces it. Diffs are either `added`, `removed`, `migrated`, or `type-changed`. There is no diff for "this component existed before and its value was carried." A developer building UI around diffs would never see `modified`, even though the constant implies it's possible.

---

**allowBlindCarry doesn't match by key** `OPEN`

The `allowBlindCarry` option (used when prior state exists but no prior schema is available) only matches components by ID. If a component's ID changed but its key was preserved, blind carry will miss it. This is inconsistent with normal reconciliation, which checks keys as a fallback.

---

## 2. Works in the Demo, Fragile in Production

These things function today but would cause problems at scale or under real-world conditions.

---

**Duplicate IDs silently overwrite** `OPEN`

If the AI generates two components with the same ID, the reconciler indexes them into a map and the last one wins. No warning, no error. The first component's state is silently lost.

*When this matters:* Any AI that might hallucinate duplicate IDs in a large schema.

---

**Duplicate keys silently overwrite** `OPEN`

Same problem as duplicate IDs, but for the `key` field. Two components with the same key will collide in the matching algorithm.

---

**Unbounded checkpoint growth** `OPEN`

Every `pushSchema` call auto-creates a checkpoint. There is no maximum limit, no pruning, and no compaction. A long-lived session with many schema pushes will accumulate checkpoints without bound, growing memory usage and serialized size.

*When this matters:* Sessions that last more than a few minutes with frequent schema changes.

---

**Unbounded event log** `OPEN`

Every `recordIntent` (every keystroke, every toggle, every selection) appends to the event log forever. There is no cap, no rotation, and no compaction. The log is included in serialization.

*When this matters:* Forms with text inputs where the user types a lot. Each character is a separate event.

---

**No persistence size guard** `OPEN`

The persistence layer catches storage errors silently but doesn't check how much data it's writing. localStorage is typically limited to 5-10 MB. A session with a large event log, many checkpoints, and complex state can silently fail to persist with no warning to the developer or user.

---

**No debouncing on persistence writes** `OPEN`

Every snapshot change triggers a synchronous `JSON.stringify` of the entire session followed by a `localStorage.setItem`. When a user types in a text input, this fires on every keystroke. For a session with a large event log, this means a potentially expensive serialization on every character typed.

---

**Migration works by accident in the demo** `OPEN`

Step 3 of the playground demo shows an "email migration" (hash changes from v1 to v2). The migration rule references a strategy ID (`email-v1-to-v2`), but no strategy registry is provided. The migration "succeeds" only because the fallback path in the reconciler passes state through unchanged when the component type matches. No actual migration function runs.

*When this matters:* If a developer looks at the demo and expects real migration to work, they'll find that the strategy registry is disconnected from the session.

---

**No cycle detection on children** `OPEN`

The reconciler recursively walks `comp.children` with no depth limit and no visited-set. A malformed schema where component A contains component B which contains component A would cause a stack overflow.

---

**Schema hash is structurally weak** `OPEN`

The internal `computeSchemaHash` function sorts all component hashes and joins them with `:`. Two schemas with identical component hashes but completely different structures (different nesting, different IDs, different order) produce the same schema hash.

---

**No React.memo on rendered components** `OPEN`

Every snapshot change (including unrelated components' state changes) triggers a full re-render of every component in the tree. There is no memoization to skip re-rendering components whose state hasn't changed.

*When this matters:* Forms with more than ~10 components, especially if any component is expensive to render.

---

**N subscriptions for N components** `OPEN`

Each rendered component creates its own `useSyncExternalStore` subscription. When any state changes, all N subscription callbacks fire and all N `getSnapshot` functions run. There is no batching or selector optimization.

---

**Provider component map reference equality** `OPEN`

If the parent component re-renders and creates a new component map object literal on each render, the provider's context value changes, causing all consumers to re-render. The component map must be defined outside the render function or wrapped in `useMemo`.

---

**Containers subscribe to state unnecessarily** `OPEN`

Container-type components (wrappers that only render children) still call `useContinuumState` and subscribe to state changes, even though they have no state of their own.

---

**Math.random for ID generation** `OPEN`

Session IDs, checkpoint IDs, and interaction IDs are generated using `Math.random().toString(36)`. While collisions are unlikely in short sessions, this is not suitable for distributed systems or high-volume logging.

---

**Deep clone via JSON round-trip** `OPEN`

Checkpoints and rewind use `JSON.parse(JSON.stringify(...))` for deep cloning. This silently drops `undefined` values, `Date` objects, `Map`/`Set`, and other non-JSON types. It also runs in O(n) on every `pushSchema`.

---

**No error on post-destroy access** `OPEN`

After calling `session.destroy()`, methods like `getSnapshot()` return `null` and `getEventLog()` returns `[]` without any indication that the session is dead. No error is thrown. A developer might not realize they're operating on a destroyed session.

---

**Snapshot hook has stale-frame issue** `OPEN`

`useContinuumSnapshot` and `useContinuumDiagnostics` use `useState` + `useEffect` rather than `useSyncExternalStore`. There is a single render frame after a session change where the hook returns stale data before the effect syncs.

---

**ViewportState defined but unused** `OPEN`

The `ViewportState` type (scroll position, zoom, offset) is defined in the contract but no component or renderer ever reads or writes it.

---

**pathPrefix parameter unused** `OPEN`

The `indexComponents` function in the reconciler accepts a `pathPrefix` parameter but never uses it or threads it through recursion. The parameter exists in the signature but has no effect.

---

**strictMode option accepted but ignored** `OPEN`

The reconciler accepts a `strictMode` option in `ReconciliationOptions` but never checks it. The option has zero effect on behavior.

---

## 3. Architectural Boundaries

These are known limits of the current design. Supporting them would require design changes, not just bug fixes.

---

**No list or repeater components** `OPEN`

Every component is a fixed node in the schema tree. There is no way to represent "a list of addresses where the user can add or remove entries." Dynamic-length collections of components are not supported. The schema is a static tree.

*When this matters:* Any form with repeatable sections (line items, addresses, phone numbers, etc.).

---

**Flat matching loses parent-child scope** `OPEN`

The reconciler indexes all components into flat maps by ID and key, regardless of nesting depth. A child component and a top-level component with the same ID or key will collide. The matching algorithm has no concept of "this ID belongs to this parent."

*When this matters:* Deeply nested schemas where the AI might reuse IDs at different levels (e.g., a "name" field inside both a "billing" section and a "shipping" section).

---

**No multi-step migration chains** `OPEN`

Migrations only support a single `fromHash -> toHash` pair. If a component's state was created at hash v1 and the new schema declares hash v3, there is no automatic v1 -> v2 -> v3 chain. The migration either finds a direct v1 -> v3 rule or falls through to the default behavior.

---

**No SSR compatibility** `OPEN`

The React provider reads from `localStorage` during the render phase to determine whether to hydrate or create a session. In a server-side rendering environment, `localStorage` doesn't exist, and the server and client would produce different initial output.

---

**No undo/redo below checkpoint level** `OPEN`

The only time-travel mechanism is checkpoint-based rewind, which restores the entire session to a prior schema-push boundary. There is no way to undo a single field edit, a single interaction, or any change smaller than a full schema version.

---

**No type registry** `OPEN`

There is no compile-time or runtime enforcement linking a component's `type` string to a specific state shape. The convention is that `input` types use `ValueInputState` and `toggle` types use `ToggleState`, but nothing enforces this. A developer could store `ToggleState` on an `input` component with no error.

---

**Checkpoint restore wipes all pending actions** `OPEN`

When restoring from a checkpoint, all pending actions are cleared -- including actions that were submitted before the checkpoint was created. The checkpoint doesn't preserve the pending action state that existed at that point in time.

---

## 4. Demo Gaps (Not Product Gaps)

These are things the playground doesn't show, not things the engine can't do. They limit what a viewer of the demo can evaluate.

---

**Only 4 component types** `OPEN`

The demo component map includes `input`, `select`, `toggle`, and `container`. No textarea, date picker, file upload, slider, radio group, checkbox group, or rich text.

---

**No deeply nested schemas** `OPEN`

All 5 demo steps use flat component lists with no `children`. The only nesting comes from the random hallucinate button. There is no intentional demo of parent-child component relationships.

---

**No large-component-count scenario** `OPEN`

All demo steps have 4-7 components. There is no stress test with 50+ components to reveal performance issues.

---

**Hallucinate button doesn't test key-based matching** `OPEN`

The hallucinate mutations change IDs but don't set `key` fields, so state is always lost on ID rename. The demo can't show Continuum's key-based state preservation through the hallucinate feature.

---

**Migration demo uses a passthrough, not a real strategy** `OPEN`

The email field's "migration" in Step 3 references a strategy ID but no strategy registry is provided. The migration appears to work only because the reconciler's fallback passes state through unchanged.

---

**No guided persistence walkthrough** `OPEN`

The refresh banner exists but there is no guided step in the demo that says "now refresh the page and watch your data survive." A viewer has to discover this on their own.

---

**No component-level error or validation states** `OPEN`

The demo has no way to show that a field is invalid, required, or in an error state. There is no visual feedback for bad input.
