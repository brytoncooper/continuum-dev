# @continuum-dev/contract

`@continuum-dev/contract` is the pure Continuum model layer.

It defines the durable, declarative shapes that describe what a Continuum view is and how user-owned state is stored against it:

- `ViewDefinition`
- `ViewNode` and node variants
- `DataSnapshot`
- `NodeValue`
- `DetachedValue`
- `ContinuitySnapshot`

## Scope

Use `@continuum-dev/contract` when you need the canonical model for:

- persisted view/data state
- schema-aware rendering
- reconciliation inputs and outputs that point back to the model
- adapters that translate external UI schemas into Continuum view definitions

Keep workflow and operational protocol types out of this package.

Those now live in [`@continuum-dev/protocol`](../protocol/README.md), which owns:

- issue and diff taxonomies
- interactions, intents, and checkpoints
- action handler contracts
- view patch and stream parts
- session stream metadata
- detached restore review DTOs

## Installation

```bash
npm install @continuum-dev/contract
```

## Minimal Example

```ts
import type {
  ContinuitySnapshot,
  DataSnapshot,
  ViewDefinition,
} from '@continuum-dev/contract';

const view: ViewDefinition = {
  viewId: 'profile',
  version: '1',
  nodes: [
    {
      id: 'name',
      type: 'field',
      dataType: 'string',
      label: 'Name',
    },
  ],
};

const data: DataSnapshot = {
  values: {
    name: { value: 'Ada' },
  },
  lineage: {
    timestamp: Date.now(),
    sessionId: 'session-1',
    viewId: view.viewId,
    viewVersion: view.version,
  },
};

const snapshot: ContinuitySnapshot = { view, data };
```

## Model Rules

- `DataSnapshot.values` is keyed by node id.
- `NodeValue` represents collaborative state, not just a raw primitive.
- `DetachedValue` preserves user data when a node disappears or changes incompatibly.
- `ContinuitySnapshot` is always the atomic `{ view, data }` pair.

## Related Packages

- `@continuum-dev/protocol`: shared operational contracts above the model layer
- `@continuum-dev/runtime`: reconciliation engine
- `@continuum-dev/session`: session lifecycle and streaming state
