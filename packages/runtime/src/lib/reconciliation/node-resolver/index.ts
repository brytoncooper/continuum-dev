import type { DataSnapshot, ViewNode } from '@continuum-dev/contract';
import {
  determineNodeMatchStrategy,
  findPriorNode,
  type ReconciliationContext,
} from '../../context/index.js';
import type {
  NodeResolutionAccumulator,
  ReconciliationOptions,
} from '../../types.js';
import { resolveNode as resolveNodeImpl } from './matched-node.js';
import { findDetachedValueForNode as findDetachedValueForNodeImpl } from './detached-values.js';
import { detectRemovedNodes as detectRemovedNodesImpl } from './removed-nodes.js';
import type { NodeMatchEnvelope } from './types.js';

/**
 * Resolves all nodes in the new view into carried, added, migrated, detached,
 * and restored outcomes.
 *
 * Determinism contract:
 * - Iterates `ctx.newById` in insertion order.
 * - Preserves resolver branch precedence from `resolveNode`.
 * - Uses deterministic prior-value lookup and id fallback semantics.
 *
 * Import boundary:
 * - Prefer importing from `node-resolver/index.js`.
 * - Do not deep-import resolver internals from this directory.
 */
export const resolveAllNodes = resolveAllNodesImpl;

/**
 * Detects prior snapshot nodes that no longer exist in the new view and emits
 * removal diffs, optional NODE_REMOVED issues, and detached values.
 *
 * Import boundary:
 * - Prefer importing from `node-resolver/index.js`.
 * - Do not deep-import resolver internals from this directory.
 */
export const detectRemovedNodes = detectRemovedNodesImpl;

/**
 * Finds the best detached-value candidate for a node using deterministic
 * precedence: unique semantic key -> key -> node id.
 *
 * Import boundary:
 * - Prefer importing from `node-resolver/index.js`.
 * - Do not deep-import resolver internals from this directory.
 */
export const findDetachedValueForNode = findDetachedValueForNodeImpl;

function resolveAllNodesImpl(
  ctx: ReconciliationContext,
  priorValues: Map<string, unknown>,
  priorData: DataSnapshot,
  now: number,
  options: ReconciliationOptions
): NodeResolutionAccumulator {
  const accumulator: NodeResolutionAccumulator = {
    values: {},
    valueLineage: {},
    detachedValues: {},
    restoredDetachedKeys: new Set<string>(),
    diffs: [],
    resolutions: [],
    issues: [],
  };

  for (const [newId, newNode] of ctx.newById) {
    const match = buildNodeMatchEnvelope(
      ctx,
      newId,
      newNode,
      priorValues,
      priorData
    );

    resolveNodeImpl({
      match,
      runtime: {
        acc: accumulator,
        ctx,
        priorData,
        now,
        options,
      },
    });
  }

  return accumulator;
}

function buildNodeMatchEnvelope(
  ctx: ReconciliationContext,
  newId: string,
  newNode: ViewNode,
  priorValues: Map<string, unknown>,
  priorData: DataSnapshot
): NodeMatchEnvelope {
  const priorNode = findPriorNode(ctx, newNode);
  const priorNodeId = priorNode
    ? ctx.priorNodeIds.get(priorNode) ?? priorNode.id
    : null;
  const matchedBy = determineNodeMatchStrategy(ctx, newNode, priorNode);
  const carriedPriorValue = priorValues.get(newId);
  const priorValue =
    matchedBy === 'id'
      ? carriedPriorValue ??
        (priorNodeId ? priorData.values[priorNodeId] : undefined)
      : carriedPriorValue;

  return {
    newId,
    newNode,
    priorNode,
    priorNodeId,
    matchedBy,
    priorValue,
  };
}
