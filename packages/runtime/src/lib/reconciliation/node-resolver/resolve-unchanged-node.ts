import type { NodeValue, ViewNode } from '@continuum-dev/contract';
import { carriedResolution, migratedDiff } from '../differ/index.js';
import { carryValuesMeta } from '../lineage-utils.js';
import {
  areDefaultValuesEqual,
  isProtectedValue,
} from './helpers.js';
import type { ResolveUnchangedNodeInput } from './types.js';

export function resolveUnchangedNode(input: ResolveUnchangedNodeInput): void {
  const {
    acc,
    newId,
    priorNode,
    priorNodeId,
    newNode,
    matchedBy,
    priorValue,
    priorData,
    now,
  } = input;
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
    carryValuesMeta({
      target: acc.valueLineage,
      newId,
      priorId: priorNodeId,
      priorData,
      now,
      isMigrated: false,
    });

    if (resolvedValue.didApplyDefaultChange) {
      acc.diffs.push(migratedDiff(newId, priorValue, resolvedValue.value));
    }
  } else if (shouldSeedInitialValueFromDefinition(newNode)) {
    acc.values[newId] = { value: newNode.defaultValue };
    reconciledValue = acc.values[newId];
    carryValuesMeta({
      target: acc.valueLineage,
      newId,
      priorId: priorNodeId,
      priorData,
      now,
      isMigrated: false,
    });
    acc.diffs.push(migratedDiff(newId, undefined, acc.values[newId]));
  }

  acc.resolutions.push(
    carriedResolution({
      nodeId: newId,
      priorId: priorNodeId,
      matchedBy,
      nodeType: priorNode.type,
      priorValue,
      reconciledValue,
    })
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

function shouldSeedInitialValueFromDefinition(
  newNode: ViewNode
): newNode is ViewNode & { defaultValue: unknown } {
  if (newNode.type === 'collection') {
    return false;
  }
  return 'defaultValue' in newNode && newNode.defaultValue !== undefined;
}
