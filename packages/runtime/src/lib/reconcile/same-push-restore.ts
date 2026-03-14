import { DATA_RESOLUTIONS } from '@continuum-dev/contract';
import type {
  DetachedValue,
  NodeValue,
} from '@continuum-dev/contract';
import type { ReconciliationContext } from '../context/index.js';
import type { NodeResolutionAccumulator, StateDiff } from '../types.js';
import { restoredDiff, restoredResolution } from '../reconciliation/differ/index.js';
import { findDetachedValueForNode } from '../reconciliation/node-resolver/detached-values.js';

export function restoreFromSamePushDetachments(
  resolved: NodeResolutionAccumulator,
  removals: {
    diffs: StateDiff[];
    detachedValues?: Record<string, DetachedValue>;
  },
  ctx: ReconciliationContext
): void {
  const detachedValues = removals.detachedValues;
  if (!detachedValues || Object.keys(detachedValues).length === 0) {
    return;
  }

  for (let index = 0; index < resolved.resolutions.length; index += 1) {
    const resolution = resolved.resolutions[index];
    if (resolution.resolution !== DATA_RESOLUTIONS.ADDED) {
      continue;
    }

    const nodeId = resolution.nodeId;
    const newNode = ctx.newById.get(nodeId);
    if (!newNode) {
      continue;
    }

    const detachedMatch = findDetachedValueForNode(detachedValues, newNode, nodeId);
    if (
      !detachedMatch ||
      detachedMatch.detachedValue.previousNodeType !== newNode.type
    ) {
      continue;
    }

    resolved.values[nodeId] = detachedMatch.detachedValue.value as NodeValue;
    resolved.restoredDetachedKeys.add(detachedMatch.detachedKey);
    removeAddedDiff(resolved.diffs, nodeId);
    resolved.diffs.push(restoredDiff(nodeId, detachedMatch.detachedValue.value));
    resolved.resolutions[index] = restoredResolution(
      nodeId,
      newNode.type,
      detachedMatch.detachedValue.value
    );
  }
}

function removeAddedDiff(diffs: StateDiff[], nodeId: string): void {
  const addedDiffIndex = diffs.findIndex(
    (diff) => diff.nodeId === nodeId && diff.type === 'added'
  );
  if (addedDiffIndex !== -1) {
    diffs.splice(addedDiffIndex, 1);
  }
}
