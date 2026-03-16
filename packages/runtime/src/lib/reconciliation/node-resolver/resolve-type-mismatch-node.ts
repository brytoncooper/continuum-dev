import type { NodeValue } from '@continuum-dev/contract';
import { ISSUE_CODES, ISSUE_SEVERITY } from '@continuum-dev/protocol';
import { detachedResolution, typeChangedDiff } from '../differ/index.js';
import { createDetachedValue } from './detached-values.js';
import type { ResolveTypeMismatchedNodeInput } from './types.js';

export function resolveTypeMismatchedNode(
  input: ResolveTypeMismatchedNodeInput
): void {
  const {
    acc,
    ctx,
    newId,
    priorNode,
    priorNodeId,
    newNode,
    matchedBy,
    priorValue,
    now,
  } = input;
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
    detachedResolution({
      nodeId: newId,
      priorId: priorNodeId,
      matchedBy,
      priorType: priorNode.type,
      newType: newNode.type,
      priorValue,
    })
  );

  if (priorValue === undefined) {
    return;
  }

  const detachedKey = priorNode.key ?? priorNodeId;
  acc.detachedValues[detachedKey] = createDetachedValue({
    ctx,
    priorNode,
    priorNodeId,
    priorValue: priorValue as NodeValue,
    now,
    reason: 'type-mismatch',
  });
}
