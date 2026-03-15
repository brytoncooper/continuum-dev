import type { DetachedValue, NodeValue, ViewNode } from '@continuum-dev/contract';
import type { ReconciliationContext } from '../../context/index.js';
import { readNodeLabel, readParentLabel } from './helpers.js';

interface DetachedMatch {
  detachedKey: string;
  detachedValue: DetachedValue;
}

export interface CreateDetachedValueInput {
  ctx: ReconciliationContext;
  priorNode: ViewNode | undefined;
  priorNodeId: string;
  priorValue: NodeValue;
  now: number;
  reason: DetachedValue['reason'];
}

export function findDetachedValueForNode(
  detachedValues: Record<string, DetachedValue> | undefined,
  newNode: ViewNode,
  nodeId: string
): DetachedMatch | null {
  if (!detachedValues) {
    return null;
  }

  const bySemanticKey = findDetachedValueBySemanticKey(detachedValues, newNode);
  if (bySemanticKey) {
    return bySemanticKey;
  }

  if (newNode.key) {
    const detachedValue = detachedValues[newNode.key];
    if (detachedValue) {
      return { detachedKey: newNode.key, detachedValue };
    }
  }

  const byNodeId = detachedValues[nodeId];
  if (byNodeId) {
    return { detachedKey: nodeId, detachedValue: byNodeId };
  }

  return null;
}

export function createDetachedValue(input: CreateDetachedValueInput): DetachedValue {
  return {
    value: input.priorValue,
    previousNodeType: input.priorNode?.type ?? 'unknown',
    semanticKey: input.priorNode?.semanticKey,
    key: input.priorNode?.key,
    previousLabel: readNodeLabel(input.priorNode),
    previousParentLabel: readParentLabel(input.ctx, input.priorNodeId),
    detachedAt: input.now,
    viewVersion: input.ctx.priorView?.version ?? 'unknown',
    reason: input.reason,
  };
}

function findDetachedValueBySemanticKey(
  detachedValues: Record<string, DetachedValue>,
  newNode: ViewNode
): DetachedMatch | null {
  if (!newNode.semanticKey) {
    return null;
  }

  const matches = Object.entries(detachedValues).filter(
    ([, detachedValue]) => detachedValue.semanticKey === newNode.semanticKey
  );

  if (matches.length !== 1) {
    return null;
  }

  const [detachedKey, detachedValue] = matches[0];
  return { detachedKey, detachedValue };
}
