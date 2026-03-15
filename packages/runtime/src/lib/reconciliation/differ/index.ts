import {
  addedDiff as addedDiffImpl,
  removedDiff as removedDiffImpl,
  typeChangedDiff as typeChangedDiffImpl,
  migratedDiff as migratedDiffImpl,
  restoredDiff as restoredDiffImpl,
} from './diff-factories.js';
import {
  addedResolution as addedResolutionImpl,
  carriedResolution as carriedResolutionImpl,
  detachedResolution as detachedResolutionImpl,
  migratedResolution as migratedResolutionImpl,
  restoredResolution as restoredResolutionImpl,
} from './resolution-factories.js';
import type {
  CarriedResolutionInput as CarriedResolutionInputModel,
  DetachedResolutionInput as DetachedResolutionInputModel,
  MigratedResolutionInput as MigratedResolutionInputModel,
} from './types.js';

/**
 * Stable public boundary for reconciliation diff/resolution record factories.
 *
 * Why this exists:
 * - Keeps callsites off implementation files (`diff-factories`, `resolution-factories`).
 * - Provides one canonical import path for deterministic record construction.
 * - Exposes typed input contracts for high-arity resolution records.
 *
 * Determinism note:
 * - These factories are pure and order-preserving; they do not read time, mutate
 *   shared state, or inspect external context.
 */

/**
 * Emits a `StateDiff` with type `added`.
 *
 * Contract:
 * - `nodeId` is the scoped id in the reconciled view.
 * - `newValue` is intentionally `undefined` because value initialization can happen
 *   in later stages and is not encoded here.
 */
export const addedDiff = addedDiffImpl;

/**
 * Emits a `StateDiff` with type `removed`.
 *
 * Contract:
 * - `oldValue` captures the prior snapshot payload that became detached/removed.
 * - `nodeId` must refer to the resolved prior-scoped node id.
 */
export const removedDiff = removedDiffImpl;

/**
 * Emits a `StateDiff` with type `type-changed`.
 *
 * Contract:
 * - `oldValue` captures the prior value that could not be safely carried.
 * - `reason` includes both prior and new node types for diagnostics.
 */
export const typeChangedDiff = typeChangedDiffImpl;

/**
 * Emits a `StateDiff` with type `migrated`.
 *
 * Contract:
 * - Use when a value was transformed due to schema/view changes.
 * - Carries both `oldValue` and `newValue` for auditability.
 */
export const migratedDiff = migratedDiffImpl;

/**
 * Emits a `StateDiff` with type `restored`.
 *
 * Contract:
 * - Use when a node value is recovered from detached storage.
 * - `newValue` is the restored payload now reattached to `nodeId`.
 */
export const restoredDiff = restoredDiffImpl;

/**
 * Emits a `ReconciliationResolution` with resolution `added`.
 *
 * Contract:
 * - Prior identity fields are always `null`.
 * - `priorValue` and `reconciledValue` are intentionally `undefined`.
 */
export const addedResolution = addedResolutionImpl;

/**
 * Emits a `ReconciliationResolution` with resolution `carried`.
 *
 * Contract:
 * - `matchedBy` must be concrete (`id`, `semanticKey`, or `key`).
 * - `priorType` and `newType` are identical (`nodeType`).
 */
export const carriedResolution = carriedResolutionImpl;

/**
 * Emits a `ReconciliationResolution` with resolution `detached`.
 *
 * Contract:
 * - `reconciledValue` is always `undefined`.
 * - `matchedBy` may be `null` when no deterministic match is available.
 */
export const detachedResolution = detachedResolutionImpl;

/**
 * Emits a `ReconciliationResolution` with resolution `migrated`.
 *
 * Contract:
 * - Captures both `priorValue` and transformed `reconciledValue`.
 * - `priorType` and `newType` can differ when migration crosses node schemas.
 */
export const migratedResolution = migratedResolutionImpl;

/**
 * Emits a `ReconciliationResolution` with resolution `restored`.
 *
 * Contract:
 * - Prior identity fields are `null` because restoration comes from detached
 *   value lookup, not direct prior-node matching.
 * - `priorType` and `newType` are set to the restored node type.
 */
export const restoredResolution = restoredResolutionImpl;

/**
 * Typed object shape for `carriedResolution`.
 *
 * Use this to avoid positional-argument ordering bugs at callsites.
 */
export type CarriedResolutionInput = CarriedResolutionInputModel;

/**
 * Typed object shape for `detachedResolution`.
 *
 * Use this to keep prior/new type fields explicit during detach paths.
 */
export type DetachedResolutionInput = DetachedResolutionInputModel;

/**
 * Typed object shape for `migratedResolution`.
 *
 * Use this when both prior and reconciled values must be recorded explicitly.
 */
export type MigratedResolutionInput = MigratedResolutionInputModel;
