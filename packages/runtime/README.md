# @continuum/runtime

The Reconciliation Engine for the Headless Continuity Runtime.

This package implements the core reconciliation logic that takes a schema (from the AI agent) and prior state (from the user) and produces a reconciled state along with diffs and issues.

## Core Function

```typescript
import { reconcile } from '@continuum/runtime';

const result = reconcile(
  newSchema,      // The current schema from the AI
  priorSchema,    // The schema the prior state was built against (or null)
  priorState,     // The user's previous state
  options         // Reconciliation options
);

// result contains:
// - reconciledState: The merged state ready to use
// - diffs: What changed during reconciliation
// - issues: Warnings, errors, or info about the process
```

## Reconciliation Process

1. **Component Matching**: Maps components from the new schema to prior state by ID
2. **Type Validation**: Ensures component types haven't changed incompatibly
3. **Schema Migration**: Attempts to migrate state when component schemas change
4. **Diff Generation**: Tracks what was added, removed, modified, or migrated
5. **Issue Detection**: Identifies conflicts, orphaned state, and migration failures
