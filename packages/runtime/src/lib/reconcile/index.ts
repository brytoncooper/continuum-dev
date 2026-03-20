import { reconcileImpl } from './reconcile-core.js';

/**
 * Reconciles a pushed `newView` against prior view/data state while preserving
 * user-entered values whenever matching and type compatibility allow it.
 *
 * Call form:
 * - `reconcile({ newView, priorView, priorData, options })`
 *
 * Behavior by input shape:
 * - `priorData === null`: returns an initial snapshot built from the new view only.
 * - `priorView === null` with prior data: prior-data-without-view fit (option-gated).
 * - `priorView` + `priorData`: runs full transition reconciliation including
 *   matching, migrations, detached-value restore, semantic-key moves, and diff
 *   emission.
 *
 * Determinism:
 * - Timestamp is derived from `options.clock` when provided.
 * - If `options.clock` is missing and `priorData` exists, timestamp is
 *   `priorData.lineage.timestamp + 1`.
 *
 * Output contract:
 * - `reconciledState` contains the next canonical snapshot.
 * - `diffs` explain added/removed/migrated/restored/type-changed nodes.
 * - `resolutions` explain how each node in `newView` was resolved.
 * - `issues` contains warnings/errors/info discovered during reconciliation.
 *
 * Import boundary:
 * - This is the only supported entrypoint for reconcile execution.
 * - Internal reconcile modules are intentionally not part of the public API.
 */
export const reconcile = reconcileImpl;
