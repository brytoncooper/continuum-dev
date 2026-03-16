import type { DataSnapshot, DetachedValue, NodeValue } from '@continuum-dev/contract';
import { ISSUE_CODES, ISSUE_SEVERITY } from '@continuum-dev/protocol';
import {
  findNewNodeByPriorNode,
  resolvePriorSnapshotId,
  type ReconciliationContext,
} from '../../context/index.js';
import type {
  ReconciliationIssue,
  ReconciliationOptions,
  StateDiff,
} from '../../types.js';
import { removedDiff } from '../differ/index.js';
import { createDetachedValue } from './detached-values.js';

export function detectRemovedNodes(
  ctx: ReconciliationContext,
  priorData: DataSnapshot,
  options: ReconciliationOptions,
  now: number
): {
  diffs: StateDiff[];
  issues: ReconciliationIssue[];
  detachedValues: Record<string, DetachedValue>;
} {
  const diffs: StateDiff[] = [];
  const issues: ReconciliationIssue[] = [];
  const detachedValues: Record<string, DetachedValue> = {};

  for (const [priorId, priorValue] of Object.entries(priorData.values)) {
    const resolvedPriorId = resolvePriorSnapshotId(ctx, priorId) ?? priorId;
    const priorNode = ctx.priorById.get(resolvedPriorId);
    const stillExists =
      ctx.newById.has(resolvedPriorId) ||
      (!!priorNode && !!findNewNodeByPriorNode(ctx, priorNode));

    if (stillExists) {
      continue;
    }

    diffs.push(removedDiff(resolvedPriorId, priorValue));

    if (priorValue !== undefined) {
      const detachedKey = priorNode?.key ?? resolvedPriorId;
      detachedValues[detachedKey] = createDetachedValue({
        ctx,
        priorNode,
        priorNodeId: resolvedPriorId,
        priorValue: priorValue as NodeValue,
        now,
        reason: 'node-removed',
      });
    }

    if (!options.allowPartialRestore) {
      issues.push({
        severity: ISSUE_SEVERITY.WARNING,
        nodeId: resolvedPriorId,
        message: `Node ${resolvedPriorId} was removed from view`,
        code: ISSUE_CODES.NODE_REMOVED,
      });
    }
  }

  return { diffs, issues, detachedValues };
}
