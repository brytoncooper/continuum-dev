# View Traversal

`view-traversal` provides deterministic traversal for view node trees and emits structural traversal issues.

## Responsibilities

- traverse all nodes in stable DFS order
- compute scoped `nodeId`, `parentPath`, and `positionPath`
- detect child cycles
- enforce maximum traversal depth

## Import Boundary

Import from:

- `packages/runtime/src/lib/reconciliation/view-traversal/index.ts`

Compatibility re-export:

- `packages/runtime/src/lib/reconciliation/view-traversal.ts`

Do not deep-import modules under:

- `packages/runtime/src/lib/reconciliation/view-traversal/*`

## Public Contracts

- `traverseViewNodes(input: TraverseViewInput)`
- `traverseViewNodes(nodes: ViewNode[], maxDepth?: number)`
- `TraversedViewNode`
- `TraverseViewInput`
- `TraverseViewResult`

The object input form is the preferred call shape.

## Internal Layout

- `traversal-core.ts` - traversal orchestration
- `types.ts` - typed contracts and frame models
- `issue-factories.ts` - issue record creation
- `path-utils.ts` - scoped id path helpers

## Determinism Guarantees

- root and child traversal order is stable
- visitation uses iterative DFS with explicit enter/exit frames
- cycle detection uses active-node re-entry checks
- max-depth checks happen before visit/descend
- issue emission order follows traversal encounter order
