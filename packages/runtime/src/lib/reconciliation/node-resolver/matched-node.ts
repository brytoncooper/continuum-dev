import type { NodeValue } from '@continuum-dev/contract';
import { validateNodeValue } from '../../validator/index.js';
import { areCompatibleContainerTypes, hasNodeHashChanged } from './helpers.js';
import { resolveCollectionNode } from './resolve-collection-node.js';
import { resolveHashChangedNode } from './resolve-hash-changed-node.js';
import { resolveNewNode } from './resolve-added-node.js';
import { resolveTypeMismatchedNode } from './resolve-type-mismatch-node.js';
import { resolveUnchangedNode } from './resolve-unchanged-node.js';
import { toConcreteMatchStrategy } from './shared.js';
import type { MatchStrategy, ResolveNodeInput } from './types.js';

type ResolutionKind =
  | 'added'
  | 'collection'
  | 'typeMismatch'
  | 'hashChanged'
  | 'unchanged';

export function resolveNode({ match, runtime }: ResolveNodeInput): void {
  const { newId, newNode, priorNode, priorNodeId, matchedBy, priorValue } =
    match;
  const { acc, ctx, priorData, now, options } = runtime;
  const concreteMatch = toConcreteMatchStrategy(matchedBy);
  const concretePriorId = priorNodeId ?? priorNode?.id ?? null;
  const resolutionKind = classifyResolutionKind(
    priorNode,
    concretePriorId,
    newNode,
    matchedBy,
    priorValue
  );

  if (resolutionKind === 'added') {
    resolveNewNode({ acc, newId, newNode, priorData });
  } else if (resolutionKind === 'collection') {
    resolveCollectionNode({
      acc,
      newId,
      priorNode: priorNode as Extract<typeof newNode, { type: 'collection' }>,
      priorNodeId: concretePriorId!,
      newNode: newNode as Extract<typeof newNode, { type: 'collection' }>,
      matchedBy: concreteMatch,
      priorValue,
      priorData,
      now,
      options,
    });
  } else if (resolutionKind === 'typeMismatch') {
    resolveTypeMismatchedNode({
      acc,
      ctx,
      newId,
      priorNode: priorNode!,
      priorNodeId: concretePriorId!,
      newNode,
      matchedBy,
      priorValue,
      now,
    });
  } else if (resolutionKind === 'hashChanged') {
    resolveHashChangedNode({
      acc,
      newId,
      priorNode: priorNode!,
      priorNodeId: concretePriorId!,
      newNode,
      matchedBy: concreteMatch,
      priorValue,
      priorData,
      now,
      options,
    });
  } else {
    resolveUnchangedNode({
      acc,
      newId,
      priorNode: priorNode!,
      priorNodeId: concretePriorId!,
      newNode,
      matchedBy: concreteMatch,
      priorValue,
      priorData,
      now,
    });
  }

  acc.issues.push(
    ...validateNodeValue(newNode, acc.values[newId] as NodeValue | undefined)
  );
}

function classifyResolutionKind(
  priorNode: ResolveNodeInput['match']['priorNode'],
  concretePriorId: string | null,
  newNode: ResolveNodeInput['match']['newNode'],
  matchedBy: MatchStrategy,
  priorValue: unknown
): ResolutionKind {
  if (
    !priorNode ||
    concretePriorId === null ||
    shouldTreatAsAdded(matchedBy, priorValue)
  ) {
    return 'added';
  }

  if (newNode.type === 'collection' && priorNode.type === 'collection') {
    return 'collection';
  }

  if (
    priorNode.type !== newNode.type &&
    !areCompatibleContainerTypes(priorNode.type, newNode.type)
  ) {
    return 'typeMismatch';
  }

  if (hasNodeHashChanged(priorNode, newNode)) {
    return 'hashChanged';
  }

  return 'unchanged';
}

function shouldTreatAsAdded(
  matchedBy: MatchStrategy,
  priorValue: unknown
): boolean {
  return matchedBy !== null && matchedBy !== 'id' && priorValue === undefined;
}
