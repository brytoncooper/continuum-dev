# @continuum-dev/contract

**The foundational type system for AI-generated UI continuity.**

When building agentic UIs, teams eventually hit the re-render problem: when an AI agent streams a new schema or layout, the frontend remounts and local user input gets lost.

`@continuum-dev/contract` defines a strict boundary between **View** (AI-owned structure) and **Data** (user-owned state). This package is zero-dependency and contains the shared TypeScript contracts used across the Continuum ecosystem.

## Installation

```bash
npm install @continuum-dev/contract
```

## The Mental Model

Continuum uses three core contracts:

- `ViewDefinition` (AI-owned): a versioned tree describing UI structure.
- `DataSnapshot` (user-owned): a flat dictionary of user state keyed by node id.
- `ContinuitySnapshot`: the atomic pairing of `view` and `data`.

Because data is flat and separate from the tree, views can be restructured without losing user input.

## Node Identity Guidance (`id` and `key`)

- `id` is required and is the primary lookup key for `DataSnapshot.values`.
- `key` is optional in the type system, but should be adopted in production for stable semantic identity across view versions.
- If AI-generated views can rename or regenerate node ids, `key` is what allows reliable matching and data carry/migration.
- Recommended practice: include `key` on all data-bearing nodes (`FieldNode`) and on structural nodes that need continuity-aware matching.

## The Secret Sauce: `NodeValue`

In Continuum, values are collaborative, not raw primitives:

```ts
interface NodeValue<T = unknown> {
  value: T;
  suggestion?: T;
  isDirty?: boolean;
  isValid?: boolean;
}
```

- `suggestion` lets AI propose alternatives.
- `isDirty` protects user-edited values from accidental overwrite.
- `isValid` tracks compatibility with current constraints.

## No Data Left Behind: `DetachedValue`

If a view update removes or changes a node incompatibly, data is preserved in `detachedValues`:

```ts
interface DetachedValue {
  value: unknown;
  previousNodeType: string;
  reason: 'node-removed' | 'type-mismatch' | 'migration-failed';
}
```

If the node returns in a compatible form, data can be restored.

## Minimal Example

```ts
import {
  ViewDefinition,
  DataSnapshot,
  ContinuitySnapshot,
} from '@continuum-dev/contract';

const view: ViewDefinition = {
  viewId: 'loan-application',
  version: '2.1.0',
  nodes: [
    {
      id: 'fullName',
      type: 'field',
      dataType: 'string',
      label: 'Full Name',
      key: 'applicant.fullName',
      constraints: { required: true, minLength: 2 },
    },
  ],
};

const data: DataSnapshot = {
  values: {
    fullName: {
      value: 'Jordan Lee',
      isDirty: true,
      isValid: true,
    },
  },
  lineage: {
    timestamp: 1740700800000,
    sessionId: 'sess-123',
    viewId: view.viewId,
    viewVersion: view.version,
  },
};

const snapshot: ContinuitySnapshot = {
  view,
  data,
};
```

## API Quick Reference

Import everything from the package root:

```ts
import {
  ViewDefinition,
  ViewNode,
  DataSnapshot,
  ContinuitySnapshot,
  NodeValue,
  ProposedValue,
  DetachedValue,
  ViewportState,
  ActionHandler,
  ActionContext,
  ISSUE_CODES,
  DATA_RESOLUTIONS,
  VIEW_DIFFS,
  INTERACTION_TYPES,
  INTENT_STATUS,
} from '@continuum-dev/contract';
```

**Core types:**

* `ViewDefinition`: root AST for generated UI.
* `ViewNode`: discriminated union of supported node types.
* `DataSnapshot`: user-owned runtime state.
* `ContinuitySnapshot`: atomic `ViewDefinition + DataSnapshot`.

**State primitives:**

* `NodeValue<T>`: value wrapper with collaboration metadata.
* `ProposedValue`: models AI suggestions alongside current user values for conflict resolution.
* `DetachedValue`: preserved state for removed or incompatible nodes.
* `ViewportState`: UI interaction state (scroll/focus/zoom/offset).

**Actions:**

* `ActionHandler`: execution contract for UI intents (`(context: ActionContext) => void | Promise<void>`).
* `ActionContext`: runtime context passed to handlers containing the intent ID, node ID, and current snapshot.

**Constants:**

* `ISSUE_CODES`: reconciliation issue taxonomy.
* `DATA_RESOLUTIONS`: value reconciliation outcomes.
* `VIEW_DIFFS`: structural diff labels.
* `INTERACTION_TYPES`: canonical interaction event categories.
* `INTENT_STATUS`: pending intent lifecycle states.

## Deep Dive Reference

For the complete breakdown of all node types, constraints, constants, and migration contracts, see [Comprehensive Contract Reference](./CONTRACT_REFERENCE.md).

## Ecosystem

This package defines the vocabulary. Other Continuum packages provide runtime behavior:

- `@continuum-dev/runtime`: stateless reconciliation engine.
- `@continuum-dev/session`: stateful session memory, history, and checkpoints.
- `@continuum-dev/react`: headless React layer for UI binding.
