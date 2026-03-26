# View Evolution Diagnostics

This module evaluates how disruptive a proposed view edit is to continuity-sensitive runtime behavior.

It is published via `@continuum-dev/runtime/view-evolution`.

## Public Surface

- `buildViewEvolutionDiagnostics`
- `shouldRejectAiEditDiagnostics`

## `buildViewEvolutionDiagnostics(...)`

```ts
buildViewEvolutionDiagnostics({
  priorView,
  nextView,
  priorData,
  nextData,
  registeredIntentIds,
})
```

The diagnostic pass computes:

- `nodesReplaced`
- `nodesPatchedInPlace`
- `replacementRatio`
- `semanticKeyChurnCount`
- `continuityLossCount`
- `detachedFieldDelta`
- `maxLayoutDepthPrior`
- `maxLayoutDepthNext`
- `layoutDepthDelta`
- `orphanedActionCount`

It also emits issues for the continuity and authoring problems the runtime cares about most, including:

- missing `semanticKey` on stateful nodes,
- duplicate stateful semantic keys,
- missing or invalid collection templates,
- continuity loss across semantic keys,
- semantic-key churn on stable ids,
- layout depth explosion or maximum depth violations,
- detached-field growth,
- orphaned action intents when intent ids are provided.

## `shouldRejectAiEditDiagnostics(...)`

```ts
shouldRejectAiEditDiagnostics(diagnostics, options?)
```

This helper returns `true` when the proposed edit should be rejected or retried.

Current rejection rules are:

- any diagnostic issue with severity `error`,
- `semanticKeyChurnCount > 3`,
- `continuityLossCount > 2`,
- `replacementRatio > 0.5` unless `ignoreReplacementRatio` is enabled,
- any detached-field growth.

## Intended Use

Use this module before committing AI-authored structural edits or when building guardrails around automated view generation.

It is a diagnostic and policy helper, not part of the core reconcile pipeline.
