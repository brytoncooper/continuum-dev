import {
  createInitialCollectionValue,
  resolveCollectionDefaultValues,
} from './defaults.js';
import { normalizeCollectionValue } from './normalization.js';
import { reconcileCollectionValue as reconcileCollectionValueImpl } from './reconcile-collection-value.js';
import type { CollectionResolutionResult } from './types.js';

/**
 * Reconciles a collection node across view transitions while preserving item
 * order, migration outcomes, and issue semantics deterministically.
 *
 * Import boundary:
 * - Prefer importing this function from `collection-resolver/index.js`.
 * - Do not deep-import implementation files under this directory.
 */
export const reconcileCollectionValue = reconcileCollectionValueImpl;

/**
 * Creates the initial canonical node value for a collection.
 *
 * Applies defaultValues when provided, otherwise seeds `minItems` entries with
 * template-derived defaults.
 */
export { createInitialCollectionValue };

/**
 * Normalizes unknown collection state into canonical `NodeValue` shape.
 *
 * Preserves known top-level metadata fields used by reconciliation.
 */
export { normalizeCollectionValue };

/**
 * Resolves collection state directly from `defaultValues` plus template
 * defaults for missing fields.
 */
export { resolveCollectionDefaultValues };

export type { CollectionResolutionResult };
