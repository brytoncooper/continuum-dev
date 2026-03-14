import type { ViewNode } from '@continuum-dev/contract';
import type { ReconciliationResolution } from '../types.js';
import { isUnique, toScopedKey } from './helpers.js';
import type { ReconciliationContext } from './types.js';

type MatchStrategy = ReconciliationResolution['matchedBy'];

export function findPriorNode(
  ctx: ReconciliationContext,
  newNode: ViewNode
): ViewNode | null {
  const newNodeId = ctx.newNodeIds.get(newNode) ?? newNode.id;
  const byId = ctx.priorById.get(newNodeId);
  if (byId) {
    return byId;
  }

  const bySemanticKey = findPriorNodeBySemanticKey(ctx, newNode);
  if (bySemanticKey) {
    return bySemanticKey;
  }

  const byKey = findPriorNodeByKey(ctx, newNode);
  if (byKey) {
    return byKey;
  }

  return null;
}

export function determineNodeMatchStrategy(
  ctx: ReconciliationContext,
  newNode: ViewNode,
  priorNode: ViewNode | null
): MatchStrategy {
  if (!priorNode) {
    return null;
  }

  const newNodeId = ctx.newNodeIds.get(newNode) ?? newNode.id;
  if (ctx.priorById.get(newNodeId) === priorNode) {
    return 'id';
  }

  if (findPriorNodeBySemanticKey(ctx, newNode) === priorNode) {
    return 'semanticKey';
  }

  if (findPriorNodeByKey(ctx, newNode) === priorNode) {
    return 'key';
  }

  return null;
}

export function findNewNodeByPriorNode(
  ctx: ReconciliationContext,
  priorNode: ViewNode
): ViewNode | null {
  const bySemanticKey = findNewNodeBySemanticKey(ctx, priorNode);
  if (bySemanticKey) {
    return bySemanticKey;
  }

  if (!priorNode.key) {
    return null;
  }

  const priorNodeId = ctx.priorNodeIds.get(priorNode) ?? priorNode.id;
  return ctx.newByKey.get(toScopedKey(priorNode.key, priorNodeId)) ?? null;
}

function findPriorNodeBySemanticKey(
  ctx: ReconciliationContext,
  newNode: ViewNode
): ViewNode | null {
  const semanticKey = newNode.semanticKey;
  if (!semanticKey) {
    return null;
  }

  if (!isUnique(ctx.newSemanticKeyCounts, semanticKey)) {
    return null;
  }

  if (!isUnique(ctx.priorSemanticKeyCounts, semanticKey)) {
    return null;
  }

  return ctx.priorBySemanticKey.get(semanticKey)?.node ?? null;
}

function findNewNodeBySemanticKey(
  ctx: ReconciliationContext,
  priorNode: ViewNode
): ViewNode | null {
  const semanticKey = priorNode.semanticKey;
  if (!semanticKey) {
    return null;
  }

  if (!isUnique(ctx.priorSemanticKeyCounts, semanticKey)) {
    return null;
  }

  if (!isUnique(ctx.newSemanticKeyCounts, semanticKey)) {
    return null;
  }

  return ctx.newBySemanticKey.get(semanticKey)?.node ?? null;
}

function findPriorNodeByKey(
  ctx: ReconciliationContext,
  newNode: ViewNode
): ViewNode | null {
  if (!newNode.key) {
    return null;
  }

  const newNodeId = ctx.newNodeIds.get(newNode) ?? newNode.id;
  return ctx.priorByKey.get(toScopedKey(newNode.key, newNodeId)) ?? null;
}
