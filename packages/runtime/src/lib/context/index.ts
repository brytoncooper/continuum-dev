import {
  buildReconciliationContext as buildReconciliationContextImpl,
  collectDuplicateIssues as collectDuplicateIssuesImpl,
} from './indexing.js';
import {
  determineNodeMatchStrategy as determineNodeMatchStrategyImpl,
  findNewNodeByPriorNode as findNewNodeByPriorNodeImpl,
  findPriorNode as findPriorNodeImpl,
} from './matching.js';
import {
  buildPriorValueLookupByIdAndKey as buildPriorValueLookupByIdAndKeyImpl,
  resolvePriorSnapshotId as resolvePriorSnapshotIdImpl,
} from './snapshot-values.js';
import type { ReconciliationContext as ReconciliationContextModel } from './types.js';

/**
 * Indexes the new/prior views into deterministic lookup maps used by the
 * reconciliation pipeline.
 *
 * Builds scoped IDs and scoped keys, tracks semantic-key cardinality, and
 * accumulates structural/indexing issues found during traversal.
 */
export const buildReconciliationContext = buildReconciliationContextImpl;

/**
 * Returns duplicate-indexing issues for a single view definition.
 *
 * Reports duplicate scoped node IDs, duplicate scoped keys, and ambiguous
 * semantic keys, plus traversal issues such as depth/cycle violations.
 */
export const collectDuplicateIssues = collectDuplicateIssuesImpl;

/**
 * Finds the best prior node candidate for a new node using deterministic
 * precedence: scoped ID -> unique semantic key -> scoped key.
 */
export const findPriorNode = findPriorNodeImpl;

/**
 * Explains which strategy matched a `newNode` to the supplied `priorNode`.
 *
 * Returns `'id'`, `'semanticKey'`, `'key'`, or `null` when no strategy matches.
 */
export const determineNodeMatchStrategy = determineNodeMatchStrategyImpl;

/**
 * Finds the best new-node candidate for a prior node.
 *
 * Uses unique semantic keys first, then falls back to scoped key matching.
 */
export const findNewNodeByPriorNode = findNewNodeByPriorNodeImpl;

/**
 * Creates a lookup of prior values keyed by the IDs that are relevant in the
 * new view, enabling carried values across renames/moves where matching allows.
 */
export const buildPriorValueLookupByIdAndKey =
  buildPriorValueLookupByIdAndKeyImpl;

/**
 * Normalizes a prior snapshot ID for lookup.
 *
 * Returns the same ID when it exists in the prior-view index, otherwise `null`.
 */
export const resolvePriorSnapshotId = resolvePriorSnapshotIdImpl;

/**
 * Deterministic, precomputed indexes used by context matching and carry logic.
 */
export type ReconciliationContext = ReconciliationContextModel;
