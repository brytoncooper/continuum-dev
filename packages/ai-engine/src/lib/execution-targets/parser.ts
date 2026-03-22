import { parseJson } from '../view-guardrails/index.js';
import { coerceScalarStateValue } from './coercion.js';
import type {
  ContinuumCollectionItem,
  ContinuumExecutionTarget,
  ContinuumScalarValue,
  ContinuumStateUpdate,
} from './types.js';

function findTargetInCatalog(
  catalog: ContinuumExecutionTarget[],
  nodeId: string
): ContinuumExecutionTarget | null {
  for (const target of catalog) {
    if (target.nodeId === nodeId) {
      return target;
    }
    if (Array.isArray(target.templateFields)) {
      const nested = findTargetInCatalog(target.templateFields, nodeId);
      if (nested) {
        return nested;
      }
    }
  }
  return null;
}

function isPopulateLikeInstruction(instruction: string): boolean {
  const t = instruction.trim().toLowerCase();
  if (/\b(clear|empty|erase|reset|remove|delete)\b/.test(t)) {
    return false;
  }
  return /\b(populate|prefill|fill out|fill in|fill\b|sample|demo|mock|dummy|fake|example)\b/.test(
    t
  );
}

function isWeakPopulateScalarUpdate(
  update: ContinuumStateUpdate,
  catalog: ContinuumExecutionTarget[]
): boolean {
  const target = findTargetInCatalog(catalog, update.nodeId);
  if (!target || target.nodeType === 'collection') {
    return false;
  }

  const wrapped = update.value;
  if (!wrapped || typeof wrapped !== 'object' || !('value' in wrapped)) {
    return true;
  }

  const inner = wrapped.value;
  if (inner === undefined || inner === null) {
    return true;
  }

  if (typeof inner === 'string') {
    return inner.trim().length === 0;
  }

  return false;
}

function isWeakPopulateCollectionUpdate(
  update: ContinuumStateUpdate,
  catalog: ContinuumExecutionTarget[]
): boolean {
  const target = findTargetInCatalog(catalog, update.nodeId);
  if (!target || target.nodeType !== 'collection') {
    return false;
  }

  const wrapped = update.value;
  if (!wrapped || typeof wrapped !== 'object' || !('value' in wrapped)) {
    return true;
  }

  const inner = wrapped.value;
  if (
    !inner ||
    typeof inner !== 'object' ||
    !('items' in inner) ||
    !Array.isArray((inner as { items: unknown }).items)
  ) {
    return true;
  }

  const items = (inner as { items: ContinuumCollectionItem[] }).items;
  if (items.length === 0) {
    return true;
  }

  return items.every((item) => {
    const values = item.values;
    if (!values || typeof values !== 'object') {
      return true;
    }
    return Object.values(values).every((cell) => {
      if (!cell || typeof cell !== 'object' || !('value' in cell)) {
        return true;
      }
      const v = (cell as { value: ContinuumScalarValue }).value;
      if (typeof v === 'string') {
        return v.trim().length === 0;
      }
      return false;
    });
  });
}

export type ContinuumStateResponseQuality = 'valid' | 'weak_noop' | 'invalid';

export function evaluateStateResponseQuality(
  parsed: { updates: ContinuumStateUpdate[]; status?: string } | null,
  instruction: string,
  targetCatalog: ContinuumExecutionTarget[]
): ContinuumStateResponseQuality {
  if (!parsed || parsed.updates.length === 0) {
    return 'invalid';
  }

  if (!isPopulateLikeInstruction(instruction)) {
    return 'valid';
  }

  const allWeak = parsed.updates.every((update) => {
    const target = findTargetInCatalog(targetCatalog, update.nodeId);
    if (!target) {
      return false;
    }
    if (target.nodeType === 'collection') {
      return isWeakPopulateCollectionUpdate(update, targetCatalog);
    }
    return isWeakPopulateScalarUpdate(update, targetCatalog);
  });

  return allWeak ? 'weak_noop' : 'valid';
}

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
