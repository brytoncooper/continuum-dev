import type { DataSnapshot, NodeValue, ViewNode } from '@continuum-dev/contract';
import type { NodeResolutionAccumulator } from '../../types.js';
import { carriedResolution, migratedDiff } from '../differ/index.js';
import { carryValuesMeta } from '../result-builder/index.js';
import {
  areDefaultValuesEqual,
  isProtectedValue,
} from './helpers.js';
import type { ConcreteMatchStrategy } from './shared.js';

export function resolveUnchangedNode(
  acc: NodeResolutionAccumulator,
  newId: string,
  priorNode: ViewNode,
  priorNodeId: string,
  newNode: ViewNode,
  matchedBy: ConcreteMatchStrategy,
  priorValue: unknown,
  priorData: DataSnapshot,
  now: number
): void {
  let reconciledValue: NodeValue | undefined =
    priorValue !== undefined ? (priorValue as NodeValue) : undefined;

  if (priorValue !== undefined) {
    const resolvedValue = applyDefaultValueChanges(
      newId,
      priorNodeId,
      newNode,
      priorNode,
      priorValue as NodeValue
    );

    acc.values[newId] = resolvedValue.value;
    reconciledValue = resolvedValue.value;
    carryValuesMeta(acc.valueLineage, newId, priorNodeId, priorData, now, false);

    if (resolvedValue.didApplyDefaultChange) {
      acc.diffs.push(migratedDiff(newId, priorValue, resolvedValue.value));
    }
  }

  acc.resolutions.push(
    carriedResolution(
      newId,
      priorNodeId,
      matchedBy,
      priorNode.type,
      priorValue,
      reconciledValue
    )
  );
}

function applyDefaultValueChanges(
  newId: string,
  priorNodeId: string,
  newNode: ViewNode,
  priorNode: ViewNode,
  priorValue: NodeValue
): {
  value: NodeValue;
  didApplyDefaultChange: boolean;
} {
  const resolvedValue = { ...priorValue };

  if (!shouldApplyDefaultChange(newId, priorNodeId, newNode, priorNode)) {
    return { value: resolvedValue, didApplyDefaultChange: false };
  }

  if (!('defaultValue' in newNode) || newNode.defaultValue === undefined) {
    return { value: resolvedValue, didApplyDefaultChange: false };
  }

  if (
    'defaultValue' in priorNode &&
    areDefaultValuesEqual(priorNode.defaultValue, newNode.defaultValue)
  ) {
    return { value: resolvedValue, didApplyDefaultChange: false };
  }

  if (isProtectedValue(priorValue)) {
    resolvedValue.suggestion = newNode.defaultValue;
  } else {
    resolvedValue.value = newNode.defaultValue;
  }

  return { value: resolvedValue, didApplyDefaultChange: true };
}

function shouldApplyDefaultChange(
  newId: string,
  priorNodeId: string,
  newNode: ViewNode,
  priorNode: ViewNode
): boolean {
  return (
    newId === priorNodeId ||
    (newNode.semanticKey !== undefined &&
      newNode.semanticKey === priorNode.semanticKey) ||
    (newNode.key !== undefined && newNode.key === priorNode.key)
  );
}
