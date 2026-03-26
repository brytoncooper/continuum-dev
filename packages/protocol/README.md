# @continuum-dev/protocol

```bash
npm install @continuum-dev/protocol
```

## Why It Exists

`@continuum-dev/contract` defines the durable model:

- `ViewDefinition`
- `DataSnapshot`
- `ContinuitySnapshot`
- `NodeValue`
- `DetachedValue`

That package stops at the model layer on purpose.

`@continuum-dev/protocol` exists for the shared operational contracts that sit above that model and need to be reused across runtime, session, AI, and host integrations without leaking workflow DTOs into `contract`.

That includes things like:

- reconciliation reports and issue taxonomies,
- interactions, intents, and checkpoints,
- proposals and action-handler contracts,
- view patch and stream payloads,
- transform plan payloads,
- view-evolution diagnostics and version helpers.

## How It Works

This package exports root-level TypeScript types, literal constants, and one small helper function.

It does not perform reconciliation, manage a session, execute actions, or apply patches itself.

Instead, it gives the rest of the stack one stable operational vocabulary:

- `constants`
  - stable literals like issue codes, diff kinds, interaction types, and intent statuses
- `reconciliation`
  - DTOs describing what runtime decided
- `interactions`
  - timeline records like `Interaction`, `PendingIntent`, and `Checkpoint`
- `actions` and `proposals`
  - action handler contracts and staged-value DTOs
- `view-patch`, `streams`, and `transforms`
  - normalized edit and stream payloads
- `view-evolution`
  - diagnostics, metrics, exemplar traces, and simple version advancement

In practice:

- `runtime` emits and consumes many of these contracts
- `session` persists and coordinates several of them
- AI or host layers usually construct or inspect them

## What It Is

`@continuum-dev/protocol` is a headless TypeScript protocol package built on top of `@continuum-dev/contract`.

Import everything from the package root:

```ts
import {
  ISSUE_CODES,
  advanceContinuumViewVersion,
  type ActionHandler,
  type ReconciliationResult,
  type SessionStreamPart,
} from '@continuum-dev/protocol';
```

There are no public subpath imports.

## Simplest Way To Use It

Most users do not "run" protocol directly.

The simplest use is:

- import stable constants and types from the package root
- create normalized operational payloads in your host or AI layer
- pass them into `@continuum-dev/runtime` or `@continuum-dev/session`
- branch on stable protocol literals instead of parsing messages or inventing local enums

### Minimal Flow

```ts
import type {
  ReconciliationIssue,
  SessionStreamPart,
} from '@continuum-dev/protocol';
import {
  ISSUE_CODES,
  advanceContinuumViewVersion,
} from '@continuum-dev/protocol';

// Use the helper when you need a simple next view version label.
const nextVersion = advanceContinuumViewVersion('2', 'minor');

// Build normalized stream parts in your host or AI layer.
const parts: SessionStreamPart[] = [
  // Structural update.
  {
    kind: 'insert-node',
    parentId: 'profile_group',
    node: {
      id: 'email',
      type: 'field',
      dataType: 'string',
      semanticKey: 'person.email',
    },
  },
  // State update.
  {
    kind: 'state',
    nodeId: 'email',
    value: { value: 'ada@example.com' },
  },
  // Ephemeral progress metadata.
  {
    kind: 'status',
    status: 'Adding email field',
    level: 'info',
  },
];

// Match on stable codes instead of parsing free-form messages.
function hasBlockingIssue(issues: ReconciliationIssue[]): boolean {
  return issues.some(
    (issue) =>
      issue.code === ISSUE_CODES.TYPE_MISMATCH ||
      issue.code === ISSUE_CODES.VIEW_CHILD_CYCLE_DETECTED
  );
}
```

Those `parts` are meant to be passed into higher layers such as session stream APIs or runtime boundary helpers. `protocol` only defines the payload shape.

### Normal Protocol Order

1. use `@continuum-dev/contract` for the model itself
2. use `@continuum-dev/protocol` for operations, diagnostics, and lifecycle records around that model
3. let `@continuum-dev/runtime` or `@continuum-dev/session` own the actual behavior
4. keep your app logic keyed to protocol literals and DTOs

### About The Package Boundary

The cleanest mental model is:

- `contract`
  - the nouns
- `protocol`
  - the operational payloads about those nouns
- `runtime`
  - the stateless engine that applies policy to those nouns and payloads
- `session`
  - the stateful timeline manager that persists and coordinates those nouns and payloads

### What Is Required

Nothing is required package-wide. You use the lane you need.

The consistent rule across the package is:

- start with the discriminant or stable literal field,
- then provide the required payload for that shape.

Common examples:

- patch operations
  - `op` plus the fields required by that operation
- stream parts
  - `kind` plus the fields required by that part
- interactions
  - identity, payload, timestamp, and `viewVersion`
- checkpoints
  - `snapshot`, `eventIndex`, `timestamp`, and `trigger`

## Other Options

### Reconciliation Reports

Use these when you need machine-readable output from runtime reconciliation:

- `ReconciliationResult`
- `StateDiff`
- `ReconciliationResolution`
- `ReconciliationIssue`

Important detail:

- `ReconciliationResult.reconciledState` is a `DataSnapshot`
- it is not a full `ContinuitySnapshot`

### Actions, Proposals, And Intents

Use these when your app or host layer needs semantic actions and staged values:

- `ActionRegistration`
- `ActionContext`
- `ActionHandler`
- `ActionResult`
- `ProposedValue`
- `Interaction`
- `PendingIntent`
- `Checkpoint`

Important detail:

- `ActionContext.snapshot` is the current `DataSnapshot`
- action handlers may return `ActionResult`, `void`, or async versions of either

### View Patches And Stream Parts

Use these when you want normalized, transport-friendly edit payloads:

- `ContinuumViewPatch`
- `ContinuumViewPatchOperation`
- `ContinuumViewPatchPosition`
- `ContinuumViewStreamPart`
- `SessionStreamPart`
- `SessionStream`
- `SessionStreamResult`
- `SessionStreamDiagnostics`

Important detail:

- patch operations use `op`
- stream parts use `kind`
- `SessionStreamPart` extends structural stream parts with:
  - `state`
  - `status`
  - `node-status`

### Transform Plans

Use these when you want to describe explicit continuity transforms during view evolution:

- `ContinuumTransformPlan`
- `ContinuumTransformOperation`
- `CONTINUUM_TRANSFORM_STRATEGIES`

Current built-in strategy ids:

- `identity`
- `concat-space`
- `split-space`

### View Evolution

Use these when you want diagnostics or simple version labeling around authored edits:

- `advanceContinuumViewVersion(...)`
- `ViewEvolutionDiagnostic`
- `ViewEvolutionDiagnostics`
- `ViewEvolutionMetrics`
- `ScopedEditBrief`
- `ContinuumEditExemplarTrace`

Important detail:

- `advanceContinuumViewVersion(...)` is a simple revision helper
- it does not implement full semantic-version semantics

Examples:

```ts
advanceContinuumViewVersion('2', 'major');   // '3'
advanceContinuumViewVersion('2', 'minor');   // '2.1'
advanceContinuumViewVersion('v2', 'major');  // 'v3'
advanceContinuumViewVersion('baseline', 'minor'); // 'baseline.1'
```

## Related Packages

- `@continuum-dev/contract`
  - the pure view/data model below protocol
- `@continuum-dev/runtime`
  - the stateless engine that emits and consumes several protocol DTOs
- `@continuum-dev/session`
  - the stateful lifecycle layer that persists and coordinates several protocol DTOs

## Dictionary Contract

### Core Terms

- `protocol`
  - the shared operational contract layer above the pure model layer
- `issue`
  - a machine-readable warning, error, or info finding
- `diff`
  - a machine-readable description of one structural/value transition outcome
- `resolution`
  - the per-node explanation of how runtime resolved prior and new state
- `stream part`
  - one normalized incremental edit or status payload
- `patch`
  - a batch of structural edit operations

### `IssueCode`

Exact values:

```ts
'NO_PRIOR_DATA'
| 'NO_PRIOR_VIEW'
| 'TYPE_MISMATCH'
| 'NODE_REMOVED'
| 'MIGRATION_FAILED'
| 'UNVALIDATED_CARRY'
| 'VALIDATION_FAILED'
| 'UNKNOWN_NODE'
| 'DUPLICATE_NODE_ID'
| 'DUPLICATE_NODE_KEY'
| 'VIEW_CHILD_CYCLE_DETECTED'
| 'VIEW_MAX_DEPTH_EXCEEDED'
| 'COLLECTION_CONSTRAINT_VIOLATED'
| 'SCOPE_COLLISION'
| 'SEMANTIC_KEY_MISSING_STATEFUL'
| 'SEMANTIC_KEY_CHURN'
| 'VIEW_REPLACEMENT_RATIO_HIGH'
| 'DETACHED_FIELD_GROWTH'
| 'CONTINUITY_LOSS'
| 'ORPHANED_ACTION_INTENT'
| 'LAYOUT_DEPTH_EXPLOSION'
| 'COLLECTION_TEMPLATE_INVALID'
```

### `DataResolution`

```ts
'carried' | 'migrated' | 'detached' | 'added' | 'restored'
```

### `ViewDiff`

```ts
'added' | 'removed' | 'migrated' | 'type-changed' | 'restored'
```

### `IssueSeverity`

```ts
'error' | 'warning' | 'info'
```

### `InteractionType`

```ts
'data-update' | 'value-change' | 'view-context-change'
```

### `IntentStatus`

```ts
'pending' | 'validated' | 'stale' | 'cancelled'
```

### `Checkpoint.trigger`

```ts
'auto' | 'manual'
```

### `ReconciliationResolution.matchedBy`

```ts
'id' | 'semanticKey' | 'key' | null
```

### `DetachedRestoreScope.kind`

```ts
'live' | 'draft'
```

### `DetachedRestoreReview.status`

```ts
'waiting' | 'candidates' | 'approved'
```

### `SessionStreamMode`

```ts
'foreground' | 'draft'
```

### `SessionStreamStatus`

```ts
'open' | 'committed' | 'aborted' | 'stale' | 'superseded'
```

### `SessionStreamStatusLevel`

```ts
'info' | 'success' | 'warning' | 'error'
```

### `ContinuumViewPatchOperation.op`

```ts
'insert-node'
| 'move-node'
| 'wrap-nodes'
| 'replace-node'
| 'remove-node'
| 'append-content'
```

### `ContinuumViewStreamPart.kind`

```ts
'view'
| 'patch'
| 'insert-node'
| 'move-node'
| 'wrap-nodes'
| 'replace-node'
| 'remove-node'
| 'append-content'
```

### `SessionStreamPart.kind`

```ts
'view'
| 'patch'
| 'insert-node'
| 'move-node'
| 'wrap-nodes'
| 'replace-node'
| 'remove-node'
| 'append-content'
| 'state'
| 'status'
| 'node-status'
```

### `ContinuumTransformOperation.kind`

```ts
'carry' | 'merge' | 'split' | 'drop' | 'detach'
```

### `ContinuumTransformStrategyId`

```ts
'identity' | 'concat-space' | 'split-space'
```

### `ContinuumViewRevisionMode`

```ts
'major' | 'minor'
```

### `ContinuumEditExemplarTrace.phase`

```ts
'patch' | 'transform' | 'view' | 'state'
```

### `ScopedEditBrief.expectedContinuityImpact`

```ts
'low' | 'medium' | 'high'
```

### `SessionViewApplyOptions`

Current fields:

```ts
{
  transient?: boolean;
  transformPlan?: ContinuumTransformPlan;
}
```

## License

MIT
