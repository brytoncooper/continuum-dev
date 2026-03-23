import type {
  DataSnapshot,
  NodeValue,
  ValueLineage,
  ViewDefinition,
} from '@continuum-dev/contract';
import {
  CONTINUUM_TRANSFORM_STRATEGIES,
  DATA_RESOLUTIONS,
  VIEW_DIFFS,
  type ContinuumTransformOperation,
  type ContinuumTransformPlan,
  type ReconciliationResolution,
  type StateDiff,
} from '@continuum-dev/protocol';
import { resolveNodeLookupEntry } from './node-lookup.js';

interface ApplyContinuumTransformPlanInput {
  priorView: ViewDefinition;
  priorData: DataSnapshot;
  nextView: ViewDefinition;
  reconciledData: DataSnapshot;
  plan: ContinuumTransformPlan;
  diffs: StateDiff[];
  resolutions: ReconciliationResolution[];
}

interface ApplyContinuumTransformPlanResult {
  data: DataSnapshot;
  diffs: StateDiff[];
  resolutions: ReconciliationResolution[];
  consumedSourceNodeIds: string[];
}

interface SourceValueMatch {
  canonicalId: string;
  nodeType: string;
  detachedKeys: string[];
  nodeValue: NodeValue | undefined;
  valueLineage: ValueLineage | undefined;
}

function dedupe<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function cloneNodeValue(nodeValue: NodeValue): NodeValue {
  return structuredClone(nodeValue) as NodeValue;
}

function readDetachedKeys(
  priorLookup: NonNullable<ReturnType<typeof resolveNodeLookupEntry>>
): string[] {
  return dedupe(
    [priorLookup.canonicalId, priorLookup.node.key].filter(
      (value): value is string => typeof value === 'string' && value.length > 0
    )
  );
}

function readSourceValue(
  priorView: ViewDefinition,
  priorData: DataSnapshot,
  sourceNodeId: string
): SourceValueMatch {
  const lookup = resolveNodeLookupEntry(priorView.nodes, sourceNodeId);
  if (!lookup) {
    throw new Error(
      `Transform source node "${sourceNodeId}" was not found in the prior view.`
    );
  }

  return {
    canonicalId: lookup.canonicalId,
    nodeType: lookup.node.type,
    detachedKeys: readDetachedKeys(lookup),
    nodeValue: priorData.values[lookup.canonicalId],
    valueLineage: priorData.valueLineage?.[lookup.canonicalId],
  };
}

function resolveTargetCanonicalId(
  nextView: ViewDefinition,
  targetNodeId: string
): { canonicalId: string; nodeType: string } {
  const lookup = resolveNodeLookupEntry(nextView.nodes, targetNodeId);
  if (!lookup) {
    throw new Error(
      `Transform target node "${targetNodeId}" was not found in the next view.`
    );
  }

  return {
    canonicalId: lookup.canonicalId,
    nodeType: lookup.node.type,
  };
}

function coerceToken(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return '';
}

function buildDerivedNodeValue(
  value: unknown,
  sourceValues: NodeValue[]
): NodeValue {
  return {
    value,
    ...(sourceValues.some((candidate) => candidate.isDirty === true)
      ? { isDirty: true }
      : {}),
    ...(sourceValues.some((candidate) => candidate.isSticky === true)
      ? { isSticky: true }
      : {}),
    ...(sourceValues.some((candidate) => candidate.isValid === false)
      ? { isValid: false }
      : {}),
  };
}

function applyIdentityTransform(sourceValues: NodeValue[]): NodeValue | null {
  const sourceValue = sourceValues[0];
  if (!sourceValue) {
    return null;
  }

  return cloneNodeValue(sourceValue);
}

function applyConcatSpaceTransform(
  sourceValues: NodeValue[]
): NodeValue | null {
  if (sourceValues.length === 0) {
    return null;
  }

  const tokens = sourceValues.map((sourceValue) =>
    coerceToken(sourceValue.value).trim()
  );
  const joined = tokens.filter((token) => token.length > 0).join(' ');

  return buildDerivedNodeValue(joined, sourceValues);
}

function applySplitSpaceTransform(
  sourceValue: NodeValue,
  targetCount: number
): NodeValue[] {
  const rawText = coerceToken(sourceValue.value).trim();
  const pieces = rawText.length > 0 ? rawText.split(/\s+/u) : [];
  const results = Array.from({ length: targetCount }, () =>
    buildDerivedNodeValue('', [sourceValue])
  );

  if (targetCount === 0) {
    return results;
  }

  for (let index = 0; index < targetCount; index += 1) {
    const segment =
      index === targetCount - 1
        ? pieces.slice(index).join(' ')
        : pieces[index] ?? '';
    results[index] = buildDerivedNodeValue(segment, [sourceValue]);
  }

  return results;
}

function updateTargetValueLineage(
  data: DataSnapshot,
  targetCanonicalId: string,
  sourceValues: SourceValueMatch[]
): DataSnapshot {
  const valueLineage = { ...(data.valueLineage ?? {}) };
  const timestamps = sourceValues
    .map((sourceValue) => sourceValue.valueLineage?.lastUpdated)
    .filter((value): value is number => typeof value === 'number');
  const lastUpdated =
    timestamps.length > 0 ? Math.max(...timestamps) : data.lineage.timestamp;
  const interactionIds = sourceValues
    .map((sourceValue) => sourceValue.valueLineage?.lastInteractionId)
    .filter(
      (value): value is string => typeof value === 'string' && value.length > 0
    );
  const latestInteractionId =
    interactionIds.length > 0
      ? interactionIds[interactionIds.length - 1]
      : undefined;

  valueLineage[targetCanonicalId] = {
    ...(valueLineage[targetCanonicalId] ?? {}),
    lastUpdated,
    ...(latestInteractionId ? { lastInteractionId: latestInteractionId } : {}),
  };

  return {
    ...data,
    valueLineage,
  };
}

function consumeDetachedKeys(
  data: DataSnapshot,
  sourceValues: SourceValueMatch[]
): DataSnapshot {
  const detachedValues = data.detachedValues;
  if (!detachedValues) {
    return data;
  }

  const nextDetachedValues = { ...detachedValues };
  let removed = false;

  for (const sourceValue of sourceValues) {
    for (const detachedKey of sourceValue.detachedKeys) {
      if (detachedKey in nextDetachedValues) {
        delete nextDetachedValues[detachedKey];
        removed = true;
      }
    }
  }

  if (!removed) {
    return data;
  }

  if (Object.keys(nextDetachedValues).length === 0) {
    const nextData = { ...data };
    delete nextData.detachedValues;
    return nextData;
  }

  return {
    ...data,
    detachedValues: nextDetachedValues,
  };
}

function replaceDiff(diffs: StateDiff[], nextDiff: StateDiff): StateDiff[] {
  return [...diffs.filter((diff) => diff.nodeId !== nextDiff.nodeId), nextDiff];
}

function replaceResolution(
  resolutions: ReconciliationResolution[],
  nextResolution: ReconciliationResolution
): ReconciliationResolution[] {
  return [
    ...resolutions.filter(
      (resolution) => resolution.nodeId !== nextResolution.nodeId
    ),
    nextResolution,
  ];
}

function applyTargetNodeValue(args: {
  data: DataSnapshot;
  diffs: StateDiff[];
  resolutions: ReconciliationResolution[];
  targetCanonicalId: string;
  targetNodeType: string;
  derivedValue: NodeValue;
  operation: ContinuumTransformOperation;
  sourceValues: SourceValueMatch[];
}): ApplyContinuumTransformPlanResult {
  let nextData: DataSnapshot = {
    ...args.data,
    values: {
      ...args.data.values,
      [args.targetCanonicalId]: args.derivedValue,
    },
  };

  nextData = updateTargetValueLineage(
    nextData,
    args.targetCanonicalId,
    args.sourceValues
  );
  nextData = consumeDetachedKeys(nextData, args.sourceValues);

  const priorValues = args.sourceValues
    .map((sourceValue) => sourceValue.nodeValue?.value)
    .filter((value) => value !== undefined);
  const oldValue = args.data.values[args.targetCanonicalId]?.value;
  const reason = `Transform ${args.operation.kind} applied.`;

  return {
    data: nextData,
    diffs: replaceDiff(args.diffs, {
      nodeId: args.targetCanonicalId,
      type: VIEW_DIFFS.MIGRATED,
      oldValue,
      newValue: args.derivedValue.value,
      reason,
    }),
    resolutions: replaceResolution(args.resolutions, {
      nodeId: args.targetCanonicalId,
      priorId: args.sourceValues[0]?.canonicalId ?? null,
      matchedBy: null,
      priorType: args.sourceValues[0]?.nodeType ?? null,
      newType: args.targetNodeType,
      resolution: DATA_RESOLUTIONS.MIGRATED,
      priorValue: priorValues.length <= 1 ? priorValues[0] : priorValues,
      reconciledValue: args.derivedValue.value,
    }),
    consumedSourceNodeIds: args.sourceValues.map(
      (sourceValue) => sourceValue.canonicalId
    ),
  };
}

export function applyContinuumTransformPlan(
  input: ApplyContinuumTransformPlanInput
): ApplyContinuumTransformPlanResult {
  let data = input.reconciledData;
  let diffs = [...input.diffs];
  let resolutions = [...input.resolutions];
  const consumedSourceNodeIds = new Set<string>();

  for (const operation of input.plan.operations) {
    if (operation.kind === 'detach') {
      continue;
    }

    if (operation.kind === 'drop') {
      const sourceValues = operation.sourceNodeIds.map((sourceNodeId) =>
        readSourceValue(input.priorView, input.priorData, sourceNodeId)
      );
      data = consumeDetachedKeys(data, sourceValues);
      for (const sourceValue of sourceValues) {
        consumedSourceNodeIds.add(sourceValue.canonicalId);
      }
      continue;
    }

    if (operation.kind === 'carry') {
      const sourceValue = readSourceValue(
        input.priorView,
        input.priorData,
        operation.sourceNodeId
      );
      const derivedValue = sourceValue.nodeValue
        ? applyIdentityTransform([sourceValue.nodeValue])
        : null;
      if (!derivedValue) {
        continue;
      }

      const target = resolveTargetCanonicalId(
        input.nextView,
        operation.targetNodeId
      );
      ({ data, diffs, resolutions } = applyTargetNodeValue({
        data,
        diffs,
        resolutions,
        targetCanonicalId: target.canonicalId,
        targetNodeType: target.nodeType,
        derivedValue,
        operation,
        sourceValues: [sourceValue],
      }));
      consumedSourceNodeIds.add(sourceValue.canonicalId);
      continue;
    }

    if (operation.kind === 'merge') {
      const sourceValues = operation.sourceNodeIds.map((sourceNodeId) =>
        readSourceValue(input.priorView, input.priorData, sourceNodeId)
      );
      const populatedSourceValues = sourceValues
        .map((sourceValue) => sourceValue.nodeValue)
        .filter((nodeValue): nodeValue is NodeValue => Boolean(nodeValue));
      if (populatedSourceValues.length === 0) {
        continue;
      }

      const derivedValue =
        operation.strategyId === CONTINUUM_TRANSFORM_STRATEGIES.IDENTITY
          ? applyIdentityTransform(populatedSourceValues)
          : applyConcatSpaceTransform(populatedSourceValues);
      if (!derivedValue) {
        continue;
      }

      const target = resolveTargetCanonicalId(
        input.nextView,
        operation.targetNodeId
      );
      ({ data, diffs, resolutions } = applyTargetNodeValue({
        data,
        diffs,
        resolutions,
        targetCanonicalId: target.canonicalId,
        targetNodeType: target.nodeType,
        derivedValue,
        operation,
        sourceValues,
      }));
      for (const sourceValue of sourceValues) {
        consumedSourceNodeIds.add(sourceValue.canonicalId);
      }
      continue;
    }

    if (operation.kind === 'split') {
      const sourceValue = readSourceValue(
        input.priorView,
        input.priorData,
        operation.sourceNodeId
      );
      if (!sourceValue.nodeValue) {
        continue;
      }

      const derivedValues =
        operation.strategyId === CONTINUUM_TRANSFORM_STRATEGIES.SPLIT_SPACE
          ? applySplitSpaceTransform(
              sourceValue.nodeValue,
              operation.targetNodeIds.length
            )
          : [];

      for (let index = 0; index < operation.targetNodeIds.length; index += 1) {
        const derivedValue = derivedValues[index];
        if (!derivedValue) {
          continue;
        }

        const target = resolveTargetCanonicalId(
          input.nextView,
          operation.targetNodeIds[index]!
        );
        ({ data, diffs, resolutions } = applyTargetNodeValue({
          data,
          diffs,
          resolutions,
          targetCanonicalId: target.canonicalId,
          targetNodeType: target.nodeType,
          derivedValue,
          operation,
          sourceValues: [sourceValue],
        }));
      }
      consumedSourceNodeIds.add(sourceValue.canonicalId);
    }
  }

  return {
    data,
    diffs,
    resolutions,
    consumedSourceNodeIds: [...consumedSourceNodeIds],
  };
}
