# @continuum-dev/protocol

`@continuum-dev/protocol` holds the shared operational contracts that sit above the pure Continuum view/data model.

Use `@continuum-dev/contract` for the durable declarative model:

- `ViewDefinition`
- `DataSnapshot`
- `ContinuitySnapshot`
- `NodeValue`
- `DetachedValue`

Use `@continuum-dev/protocol` for cross-package workflow and wire-level shapes:

- reconciliation reports and issue taxonomies
- view patch operations and streaming parts
- session stream metadata
- restore review DTOs
- interactions, intents, checkpoints, and action contracts

This keeps `contract` focused and lets runtime/session-oriented packages share a stable protocol surface without muddying the model layer.
