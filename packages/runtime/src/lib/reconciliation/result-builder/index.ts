import { assembleReconciliationResult as assembleReconciliationResultImpl } from './assemble-result.js';
import { buildBlindCarryResult as buildBlindCarryResultImpl } from './blind-carry.js';
import { buildFreshSessionResult as buildFreshSessionResultImpl } from './fresh-session.js';
import { carryValuesMeta as carryValuesMetaImpl } from './lineage.js';
import {
  computeViewHash as computeViewHashImpl,
  generateSessionId as generateSessionIdImpl,
} from './view-hash.js';
import type {
  AssembleReconciliationResultInput as AssembleReconciliationResultInputModel,
  BlindCarryResultInput as BlindCarryResultInputModel,
  FreshNodeCollectionInput as FreshNodeCollectionInputModel,
  FreshSessionResultInput as FreshSessionResultInputModel,
  FreshLineageInput as FreshLineageInputModel,
  LineageBaseInput as LineageBaseInputModel,
  LineageWithHashInput as LineageWithHashInputModel,
  RemovedNodesResult as RemovedNodesResultModel,
} from './types.js';
import type { CarryValuesMetaInput as CarryValuesMetaInputModel } from './lineage.js';

/**
 * Stable boundary for result assembly and branch-specific reconciliation outputs.
 *
 * Why this boundary exists:
 * - keeps callers off implementation files
 * - makes high-arity callsites use typed object inputs
 * - centralizes behavior contracts for transition, fresh-session, and blind-carry flows
 *
 * Import policy:
 * - import from `../result-builder/index.js`
 * - avoid deep imports into files under `result-builder/`
 */

/**
 * Final transition-stage assembler.
 *
 * Contract highlights:
 * - combines node resolution output with removal output
 * - carries forward prior lineage and updates `timestamp`, `viewId`, `viewVersion`
 * - computes optional `viewHash` only when hashed nodes are present
 * - merges detached-value sources and removes restored keys last
 * - preserves deterministic ordering: resolved entries first, removal entries second
 */
export const assembleReconciliationResult = assembleReconciliationResultImpl;

/**
 * Builds the reconciliation result when prior data exists but prior view is unavailable.
 *
 * Contract highlights:
 * - always emits `NO_PRIOR_VIEW`
 * - if `allowBlindCarry` is false: drops values, preserves detached values
 * - if `allowBlindCarry` is true: carries only exact scoped id matches
 * - never performs key-based blind carry
 */
export const buildBlindCarryResult = buildBlindCarryResultImpl;

/**
 * Builds the reconciliation result for first-run/fresh-session flows.
 *
 * Contract highlights:
 * - initializes values from explicit defaults only
 * - initializes collection defaults via collection resolver helpers
 * - emits `added` diffs/resolutions for all visited nodes
 * - emits `NO_PRIOR_DATA` and starts a new session lineage
 */
export const buildFreshSessionResult = buildFreshSessionResultImpl;

/**
 * Copies value lineage metadata from a prior node id to a new node id.
 *
 * Contract highlights:
 * - no-op when prior lineage metadata does not exist
 * - when `isMigrated` is true, `lastUpdated` is rewritten to `now`
 * - otherwise copies lineage metadata as-is
 */
export const carryValuesMeta = carryValuesMetaImpl;

/**
 * Produces a deterministic serialized signature for hashed view nodes.
 *
 * Notes:
 * - returns `undefined` when no nodes include `hash`
 * - output is stable for equivalent view structure + hash inputs
 */
export const computeViewHash = computeViewHashImpl;

/**
 * Generates a session id seed from the reconciliation timestamp.
 */
export const generateSessionId = generateSessionIdImpl;

/**
 * Object input contract for `assembleReconciliationResult`.
 */
export type AssembleReconciliationResultInput = AssembleReconciliationResultInputModel;
/**
 * Object input contract for `buildBlindCarryResult`.
 */
export type BlindCarryResultInput = BlindCarryResultInputModel;
/**
 * Object input contract for internal fresh-node collection traversal.
 */
export type FreshNodeCollectionInput = FreshNodeCollectionInputModel;
/**
 * Object input contract for `buildFreshSessionResult`.
 */
export type FreshSessionResultInput = FreshSessionResultInputModel;
/**
 * Object input contract for fresh lineage construction.
 */
export type FreshLineageInput = FreshLineageInputModel;
/**
 * Object input contract for lineage updates based on prior lineage.
 */
export type LineageBaseInput = LineageBaseInputModel;
/**
 * Object input contract for lineage updates including optional `viewHash`.
 */
export type LineageWithHashInput = LineageWithHashInputModel;
/**
 * Canonical removal-stage output shape consumed during final assembly.
 */
export type RemovedNodesResult = RemovedNodesResultModel;
/**
 * Object input contract for value-lineage carry helper.
 */
export type CarryValuesMetaInput = CarryValuesMetaInputModel;
