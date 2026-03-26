# Restore Candidates

This module provides heuristic suggestions for where a detached value might fit in the current view tree.

It is intentionally advisory. It does not mutate runtime state and it does not auto-restore values.

## Public Surface

Published via `@continuum-dev/runtime/restore-candidates`:

- `findRestoreCandidates`
- restore-candidate types from `types.ts`
- `findNodeByIdentity`
- `determineDetachedFamily`
- `determineNodeFamily`

## `findRestoreCandidates(...)`

```ts
findRestoreCandidates(nodes, data, detachedValue): RestoreCandidateMatch[]
```

The function:

1. determines the detached value family,
2. collects candidate nodes from the current view tree,
3. keeps only candidates in the same family,
4. scores them,
5. keeps scores `>= 12`,
6. sorts by score descending, then canonical id ascending.

Each match includes:

- `targetNodeId`
- `targetLabel`
- `targetParentLabel`
- `targetSemanticKey`
- `targetKey`
- `score`

## Intended Use

Use this when a higher-level session or review workflow wants to suggest likely restore targets to a user or orchestration layer.

Do not treat the output as a deterministic restore contract. Core reconciliation restore behavior lives elsewhere and remains strict.
