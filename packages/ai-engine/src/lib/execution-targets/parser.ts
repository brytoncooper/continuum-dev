import { parseJson } from '../view-guardrails/index.js';
import { coerceScalarStateValue } from './coercion.js';
import type {
  ContinuumCollectionItem,
  ContinuumExecutionTarget,
  ContinuumScalarValue,
  ContinuumStateUpdate,
} from './types.js';

function resolveStateTarget(
  targetCatalog: ContinuumExecutionTarget[],
  reference: Record<string, unknown>
): ContinuumExecutionTarget | null {
  const preferredNodeId =
    typeof reference.nodeId === 'string' && reference.nodeId.trim().length > 0
      ? reference.nodeId.trim()
      : null;
  if (preferredNodeId) {
    const byNodeId = targetCatalog.find((target) => target.nodeId === preferredNodeId);
    if (byNodeId) {
      return byNodeId;
    }
  }

  const preferredSemanticKey =
    typeof reference.semanticKey === 'string' &&
    reference.semanticKey.trim().length > 0
      ? reference.semanticKey.trim()
      : null;
  if (preferredSemanticKey) {
    const bySemanticKey = targetCatalog.find(
      (target) => target.semanticKey === preferredSemanticKey
    );
    if (bySemanticKey) {
      return bySemanticKey;
    }
  }

  const preferredKey =
    typeof reference.key === 'string' && reference.key.trim().length > 0
      ? reference.key.trim()
      : null;
  if (preferredKey) {
    const byKey = targetCatalog.find((target) => target.key === preferredKey);
    if (byKey) {
      return byKey;
    }
  }

  return null;
}

function resolveCollectionTemplateTarget(
  collectionTarget: ContinuumExecutionTarget,
  referenceKey: string
): ContinuumExecutionTarget | null {
  if (!Array.isArray(collectionTarget.templateFields)) {
    return null;
  }

  return (
    collectionTarget.templateFields.find((target) => target.nodeId === referenceKey) ??
    collectionTarget.templateFields.find(
      (target) => target.semanticKey === referenceKey
    ) ??
    collectionTarget.templateFields.find((target) => target.key === referenceKey) ??
    null
  );
}

function normalizeScalarStateUpdate(
  target: ContinuumExecutionTarget,
  rawValue: unknown
): ContinuumStateUpdate | null {
  const value = coerceScalarStateValue(target, rawValue);
  if (value === undefined) {
    return null;
  }

  return {
    nodeId: target.nodeId,
    value: { value },
  };
}

function normalizeCollectionItemValues(
  target: ContinuumExecutionTarget,
  source: Record<string, unknown>
): Record<string, { value: ContinuumScalarValue }> {
  const values: Record<string, { value: ContinuumScalarValue }> = {};

  for (const [referenceKey, rawFieldValue] of Object.entries(source)) {
    const templateTarget = resolveCollectionTemplateTarget(target, referenceKey);
    if (!templateTarget) {
      continue;
    }

    const normalizedValue = coerceScalarStateValue(templateTarget, rawFieldValue);
    if (normalizedValue === undefined) {
      continue;
    }

    values[templateTarget.nodeId] = { value: normalizedValue };
  }

  return values;
}

function normalizeCollectionStateUpdate(
  target: ContinuumExecutionTarget,
  updateRecord: Record<string, unknown>
): ContinuumStateUpdate | null {
  const valueRecord =
    updateRecord.value && typeof updateRecord.value === 'object'
      ? (updateRecord.value as Record<string, unknown>)
      : updateRecord;

  const rawItems = Array.isArray(valueRecord.items)
    ? valueRecord.items
    : Array.isArray(updateRecord.items)
      ? updateRecord.items
      : null;

  if (!rawItems) {
    return null;
  }

  const items = rawItems
    .map((rawItem) => {
      const source =
        rawItem && typeof rawItem === 'object'
          ? ('values' in (rawItem as Record<string, unknown>) &&
            rawItem.values &&
            typeof rawItem.values === 'object'
              ? (rawItem.values as Record<string, unknown>)
              : (rawItem as Record<string, unknown>))
          : null;
      if (!source) {
        return null;
      }

      const values = normalizeCollectionItemValues(target, source);
      return Object.keys(values).length > 0 ? { values } : null;
    })
    .filter((item): item is ContinuumCollectionItem => item !== null);

  if (items.length === 0) {
    return null;
  }

  return {
    nodeId: target.nodeId,
    value: {
      value: {
        items,
      },
    },
  };
}

export function parseContinuumStateResponse(args: {
  text: string;
  targetCatalog: ContinuumExecutionTarget[];
}): {
  updates: ContinuumStateUpdate[];
  status?: string;
} | null {
  const parsed = parseJson<Record<string, unknown>>(args.text);
  if (!parsed || typeof parsed !== 'object') {
    return null;
  }

  const rawUpdates = Array.isArray(parsed.updates)
    ? parsed.updates
    : parsed.values && typeof parsed.values === 'object'
      ? Object.entries(parsed.values).map(([key, value]) => ({
          key,
          value,
        }))
      : null;

  if (!rawUpdates || rawUpdates.length === 0) {
    return null;
  }

  const updates = rawUpdates
    .map((rawUpdate) => {
      if (!rawUpdate || typeof rawUpdate !== 'object') {
        return null;
      }

      const target = resolveStateTarget(
        args.targetCatalog,
        rawUpdate as Record<string, unknown>
      );
      if (!target) {
        return null;
      }

      if (target.nodeType === 'collection') {
        return normalizeCollectionStateUpdate(
          target,
          rawUpdate as Record<string, unknown>
        );
      }

      return normalizeScalarStateUpdate(
        target,
        (rawUpdate as Record<string, unknown>).value
      );
    })
    .filter((update): update is ContinuumStateUpdate => update !== null);

  if (updates.length === 0) {
    return null;
  }

  return {
    updates,
    status:
      typeof parsed.status === 'string' && parsed.status.trim().length > 0
        ? parsed.status.trim()
        : undefined,
  };
}
