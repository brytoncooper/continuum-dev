import type { DataSnapshot, NodeValue, ViewNode } from '@continuum-dev/contract';
import { validateNodeValue } from '../../validator/index.js';
import type { ReconciliationContext } from '../../context/index.js';
import type {
  NodeResolutionAccumulator,
  ReconciliationOptions,
} from '../../types.js';
import { areCompatibleContainerTypes, hasNodeHashChanged } from './helpers.js';
import { resolveCollectionNode } from './resolve-collection-node.js';
import { resolveHashChangedNode } from './resolve-hash-changed-node.js';
import { resolveNewNode } from './resolve-added-node.js';
import { resolveTypeMismatchedNode } from './resolve-type-mismatch-node.js';
import { resolveUnchangedNode } from './resolve-unchanged-node.js';
import { toConcreteMatchStrategy, type MatchStrategy } from './shared.js';

export function resolveNode(
  acc: NodeResolutionAccumulator,
  ctx: ReconciliationContext,
  newId: string,
  newNode: ViewNode,
  priorNode: ViewNode | null,
  priorNodeId: string | null,
  matchedBy: MatchStrategy,
  priorValue: unknown,
  priorData: DataSnapshot,
  now: number,
  options: ReconciliationOptions
): void {
  const concreteMatch = toConcreteMatchStrategy(matchedBy);
  const concretePriorId = priorNodeId ?? priorNode?.id ?? null;

  if (
    !priorNode ||
    concretePriorId === null ||
    shouldTreatAsAdded(matchedBy, priorValue)
  ) {
    resolveNewNode(acc, newId, newNode, priorData);
  } else if (newNode.type === 'collection' && priorNode.type === 'collection') {
    resolveCollectionNode(
      acc,
      newId,
      priorNode,
      concretePriorId,
      newNode,
      concreteMatch,
      priorValue,
      priorData,
      now,
      options
    );
  } else if (
    priorNode.type !== newNode.type &&
    !areCompatibleContainerTypes(priorNode.type, newNode.type)
  ) {
    resolveTypeMismatchedNode(
      acc,
      ctx,
      newId,
      priorNode,
      concretePriorId,
      newNode,
      matchedBy,
      priorValue,
      now
    );
  } else if (hasNodeHashChanged(priorNode, newNode)) {
    resolveHashChangedNode(
      acc,
      newId,
      priorNode,
      concretePriorId,
      newNode,
      concreteMatch,
      priorValue,
      priorData,
      now,
      options
    );
  } else {
    resolveUnchangedNode(
      acc,
      newId,
      priorNode,
      concretePriorId,
      newNode,
      concreteMatch,
      priorValue,
      priorData,
      now
    );
  }

  acc.issues.push(
    ...validateNodeValue(newNode, acc.values[newId] as NodeValue | undefined)
  );
}

function shouldTreatAsAdded(
  matchedBy: MatchStrategy,
  priorValue: unknown
): boolean {
  return matchedBy !== null && matchedBy !== 'id' && priorValue === undefined;
}
