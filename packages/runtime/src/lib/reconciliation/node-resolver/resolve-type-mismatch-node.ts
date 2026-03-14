import type { NodeValue, ViewNode } from '@continuum-dev/contract';
import { ISSUE_CODES, ISSUE_SEVERITY } from '@continuum-dev/contract';
import type { ReconciliationContext } from '../../context/index.js';
import type { NodeResolutionAccumulator } from '../../types.js';
import { detachedResolution, typeChangedDiff } from '../differ/index.js';
import { createDetachedValue } from './detached-values.js';
import type { MatchStrategy } from './shared.js';

export function resolveTypeMismatchedNode(
  acc: NodeResolutionAccumulator,
  ctx: ReconciliationContext,
  newId: string,
  priorNode: ViewNode,
  priorNodeId: string,
  newNode: ViewNode,
  matchedBy: MatchStrategy,
  priorValue: unknown,
  now: number
): void {
  acc.issues.push({
    severity: ISSUE_SEVERITY.ERROR,
    nodeId: newId,
    message: `Node type mismatch: ${priorNode.type} -> ${newNode.type}`,
    code: ISSUE_CODES.TYPE_MISMATCH,
  });
  acc.diffs.push(
    typeChangedDiff(newId, priorValue, priorNode.type, newNode.type)
  );
  acc.resolutions.push(
    detachedResolution(
      newId,
      priorNodeId,
      matchedBy,
      priorNode.type,
      newNode.type,
      priorValue
    )
  );

  if (priorValue === undefined) {
    return;
  }

  const detachedKey = priorNode.key ?? priorNodeId;
  acc.detachedValues[detachedKey] = createDetachedValue(
    ctx,
    priorNode,
    priorNodeId,
    priorValue as NodeValue,
    now,
    'type-mismatch'
  );
}
