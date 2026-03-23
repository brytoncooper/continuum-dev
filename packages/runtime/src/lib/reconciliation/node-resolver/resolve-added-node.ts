import type { NodeValue, ViewNode } from '@continuum-dev/contract';
import {
  addedDiff,
  addedResolution,
  restoredDiff,
  restoredResolution,
} from '../differ/index.js';
import { createInitialCollectionValue } from '../collection-resolver/index.js';
import { findDetachedValueForNode } from './detached-values.js';
import type { ResolveNewNodeInput } from './types.js';

export function resolveNewNode({
  acc,
  newId,
  newNode,
  priorData,
}: ResolveNewNodeInput): void {
  const detachedMatch = findDetachedValueForNode(
    priorData.detachedValues,
    newNode,
    newId
  );

  if (
    detachedMatch &&
    detachedMatch.detachedValue.previousNodeType === newNode.type
  ) {
    acc.values[newId] = detachedMatch.detachedValue.value as NodeValue;
    acc.restoredDetachedKeys.add(detachedMatch.detachedKey);
    acc.diffs.push(restoredDiff(newId, detachedMatch.detachedValue.value));
    acc.resolutions.push(
      restoredResolution(newId, newNode.type, detachedMatch.detachedValue.value)
    );
    return;
  }

  initializeNewNodeValue(acc, newId, newNode);
  acc.diffs.push(addedDiff(newId));
  acc.resolutions.push(addedResolution(newId, newNode.type));
}

function initializeNewNodeValue(
  acc: ResolveNewNodeInput['acc'],
  newId: string,
  newNode: ViewNode
): void {
  if (newNode.type === 'collection') {
    acc.values[newId] = createInitialCollectionValue(newNode);
    return;
  }

  if ('defaultValue' in newNode && newNode.defaultValue !== undefined) {
    acc.values[newId] = { value: newNode.defaultValue };
  }
}
