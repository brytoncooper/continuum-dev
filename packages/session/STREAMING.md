# Streaming Guide

Continuum streaming now has a strict ownership split:

- `@continuum-dev/runtime` owns view patching, direct value application, viewport updates, ingress classification, and canonical reconciliation outputs.
- `@continuum-dev/session` owns stream lifecycle, proposals, checkpoints, persistence, and render-vs-committed snapshot orchestration.

## Snapshot Model

- `session.getSnapshot()` returns the current render snapshot. When a foreground stream is open, this can include in-progress streamed UI.
- `session.getCommittedSnapshot()` returns the last durable committed `{ view, data }` pair.
- User input stays sacred in both cases. Dirty or sticky committed values become proposals instead of being overwritten by streamed AI values.

## Stream Lifecycle

```ts
const stream = session.beginStream({
  targetViewId: 'loan-intake',
  source: 'ai',
  mode: 'foreground',
  baseViewVersion: session.getCommittedSnapshot()?.view.version ?? null,
});

session.applyStreamPart(stream.streamId, {
  kind: 'insert-node',
  parentId: 'borrower_group',
  node: {
    id: 'borrower_email',
    type: 'field',
    dataType: 'string',
  },
});

session.applyStreamPart(stream.streamId, {
  kind: 'append-content',
  nodeId: 'borrower_intro',
  text: ' We already preserved your existing answers.',
});

session.applyStreamPart(stream.streamId, {
  kind: 'node-status',
  nodeId: 'borrower_group',
  status: 'ready',
  level: 'success',
  subtree: true,
});

session.commitStream(stream.streamId);
```

Supported normalized stream parts:

- `view`
- `patch`
- `insert-node`
- `replace-node`
- `remove-node`
- `append-content`
- `state`
- `status`
- `node-status`

`status` updates overall stream metadata. `node-status` updates node/subtree build metadata for renderers and remains ephemeral.

## Conflict Rules

- Only one live stream may target a given `targetViewId` unless it explicitly supersedes the older stream.
- Only one foreground stream drives the render snapshot at a time.
- AI `state` updates classify through runtime first:
  - committed protected value -> proposal
  - committed unprotected value -> apply
  - render-only streamed node -> apply inside the stream draft
  - unknown node -> structured issue
- Local user edits on render-only streamed nodes stay in the stream draft until commit, or become detached values on abort.

## React Consumption

`@continuum-dev/react` now exposes:

- `useContinuumSnapshot()`
- `useContinuumCommittedSnapshot()`
- `useContinuumStreams()`
- `useContinuumStreaming()`

`ContinuumRenderer` passes additive streaming props into node components:

- `isStreaming`
- `buildState`
- `streamStatus`

That lets renderers show building/ready/error states without changing the durable contract snapshot.

## Transport Paths

Two ingestion paths are supported:

1. Structured transport parts, for example `@continuum-dev/vercel-ai-sdk`
2. Post-processed model text, normalized outside core into `SessionStreamPart[]`

The core packages never parse raw model text themselves. They only consume deterministic normalized parts.
