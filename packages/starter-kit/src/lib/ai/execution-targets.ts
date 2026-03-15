import type { ViewDefinition, ViewNode } from '@continuum-dev/core';
import { getChildNodes } from '@continuum-dev/core';
import { parseJson } from './view-guardrails.js';

const SCALAR_STATEFUL_NODE_TYPES = new Set([
  'field',
  'textarea',
  'date',
  'select',
  'radio-group',
  'slider',
  'toggle',
]);

export interface StarterKitExecutionTarget {
  nodeId: string;
  key?: string;
  semanticKey?: string;
  nodeType: string;
  label?: string;
  dataType?: string;
  options?: Array<{ value?: string; label?: string }>;
  templateFields?: StarterKitExecutionTarget[];
}

type StarterKitScalarValue = string | number | boolean;

type StarterKitCollectionItem = {
  values: Record<string, { value: StarterKitScalarValue }>;
};

export type StarterKitStateUpdate = {
  nodeId: string;
  value:
    | { value: StarterKitScalarValue }
    | { value: { items: StarterKitCollectionItem[] } };
};

function toCanonicalNodeId(nodeId: string, parentPath = ''): string {
  return parentPath ? `${parentPath}/${nodeId}` : nodeId;
}

function readNodeLabel(node: ViewNode): string | undefined {
  return 'label' in node && typeof node.label === 'string'
    ? node.label
    : undefined;
}

function unwrapNodeValueLike(rawValue: unknown): unknown {
  if (
    rawValue &&
    typeof rawValue === 'object' &&
    'value' in (rawValue as Record<string, unknown>) &&
    Object.keys(rawValue as Record<string, unknown>).length <= 5
  ) {
    return (rawValue as Record<string, unknown>).value;
  }

  return rawValue;
}

function coerceBooleanValue(rawValue: unknown): boolean | undefined {
  if (typeof rawValue === 'boolean') {
    return rawValue;
  }

  if (typeof rawValue === 'number') {
    return rawValue !== 0;
  }

  if (typeof rawValue === 'string') {
    const normalized = rawValue.trim().toLowerCase();
    if (
      normalized === 'true' ||
      normalized === 'yes' ||
      normalized === 'on' ||
      normalized === 'enabled'
    ) {
      return true;
    }

    if (
      normalized === 'false' ||
      normalized === 'no' ||
      normalized === 'off' ||
      normalized === 'disabled'
    ) {
      return false;
    }
  }

  return undefined;
}

function coerceNumberValue(rawValue: unknown): number | undefined {
  if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
    return rawValue;
  }

  if (typeof rawValue === 'string') {
    const normalized = rawValue.replace(/[$,%\s,]/g, '').trim();
    if (!normalized) {
      return undefined;
    }

    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function mapOptionValue(
  options: StarterKitExecutionTarget['options'],
  rawValue: unknown
): string | undefined {
  if (!Array.isArray(options) || options.length === 0) {
    return undefined;
  }

  const normalized =
    typeof rawValue === 'string'
      ? rawValue.trim().toLowerCase()
      : String(rawValue).trim().toLowerCase();

  const exactValue = options.find(
    (option) =>
      option &&
      typeof option.value === 'string' &&
      option.value.trim().toLowerCase() === normalized
  );
  if (exactValue?.value) {
    return exactValue.value;
  }

  const exactLabel = options.find(
    (option) =>
      option &&
      typeof option.label === 'string' &&
      option.label.trim().toLowerCase() === normalized
  );
  if (exactLabel?.value) {
    return exactLabel.value;
  }

  return undefined;
}

function coerceScalarStateValue(
  target: StarterKitExecutionTarget,
  rawValue: unknown
): string | number | boolean | undefined {
  const value = unwrapNodeValueLike(rawValue);

  if (value === undefined || value === null) {
    return undefined;
  }

  if (target.nodeType === 'toggle') {
    return coerceBooleanValue(value);
  }

  if (
    target.nodeType === 'slider' ||
    (target.nodeType === 'field' && target.dataType === 'number')
  ) {
    return coerceNumberValue(value);
  }

  if (target.nodeType === 'field' && target.dataType === 'boolean') {
    return coerceBooleanValue(value);
  }

  if (target.nodeType === 'select' || target.nodeType === 'radio-group') {
    return mapOptionValue(target.options, value);
  }

  return String(value);
}

function collectCollectionTemplateTargets(
  node: ViewNode,
  parentPath = ''
): StarterKitExecutionTarget[] {
  const canonicalNodeId = toCanonicalNodeId(node.id, parentPath);
  if (SCALAR_STATEFUL_NODE_TYPES.has(node.type)) {
    return [
      {
        nodeId: canonicalNodeId,
        key: node.key,
        semanticKey: node.semanticKey,
        nodeType: node.type,
        label: readNodeLabel(node),
        dataType: 'dataType' in node ? node.dataType : undefined,
        options: 'options' in node && Array.isArray(node.options) ? node.options : undefined,
      },
    ];
  }

  return getChildNodes(node).flatMap((child) =>
    collectCollectionTemplateTargets(child, canonicalNodeId)
  );
}

export function buildStarterKitStateTargetCatalog(
  view: ViewDefinition
): StarterKitExecutionTarget[] {
  const visit = (
    node: ViewNode,
    parentPath = ''
  ): StarterKitExecutionTarget[] => {
    const canonicalNodeId = toCanonicalNodeId(node.id, parentPath);

    if (node.type === 'collection') {
      return [
        {
          nodeId: canonicalNodeId,
          key: node.key,
          semanticKey: node.semanticKey,
          nodeType: node.type,
          label: readNodeLabel(node),
          templateFields: collectCollectionTemplateTargets(node.template),
        },
      ];
    }

    if (SCALAR_STATEFUL_NODE_TYPES.has(node.type)) {
      return [
        {
          nodeId: canonicalNodeId,
          key: node.key,
          semanticKey: node.semanticKey,
          nodeType: node.type,
          label: readNodeLabel(node),
          dataType: 'dataType' in node ? node.dataType : undefined,
          options: 'options' in node && Array.isArray(node.options) ? node.options : undefined,
        },
      ];
    }

    return getChildNodes(node).flatMap((child) => visit(child, canonicalNodeId));
  };

  return view.nodes.flatMap((node) => visit(node));
}

export function buildStarterKitPatchTargetCatalog(
  view: ViewDefinition
): StarterKitExecutionTarget[] {
  const targets: StarterKitExecutionTarget[] = [];

  const visit = (nodes: ViewNode[]): void => {
    for (const node of nodes) {
      targets.push({
        nodeId: node.id,
        key: node.key,
        semanticKey: node.semanticKey,
        nodeType: node.type,
        label: readNodeLabel(node),
      });
      visit(getChildNodes(node));
    }
  };

  visit(view.nodes);
  return targets;
}

function resolveStateTarget(
  targetCatalog: StarterKitExecutionTarget[],
  reference: Record<string, unknown>
): StarterKitExecutionTarget | null {
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
  collectionTarget: StarterKitExecutionTarget,
  referenceKey: string
): StarterKitExecutionTarget | null {
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
  target: StarterKitExecutionTarget,
  rawValue: unknown
): StarterKitStateUpdate | null {
  const value = coerceScalarStateValue(target, rawValue);
  if (value === undefined) {
    return null;
  }

  return {
    nodeId: target.nodeId,
    value: { value },
  };
}

function normalizeCollectionStateUpdate(
  target: StarterKitExecutionTarget,
  updateRecord: Record<string, unknown>
): StarterKitStateUpdate | null {
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

      const values: Record<string, { value: StarterKitScalarValue }> = {};
      for (const [referenceKey, rawFieldValue] of Object.entries(source)) {
        const templateTarget = resolveCollectionTemplateTarget(
          target,
          referenceKey
        );
        if (!templateTarget) {
          continue;
        }

        const normalizedValue = coerceScalarStateValue(
          templateTarget,
          rawFieldValue
        );
        if (normalizedValue === undefined) {
          continue;
        }

        values[templateTarget.nodeId] = { value: normalizedValue };
      }

      return Object.keys(values).length > 0 ? { values } : null;
    })
    .filter((item): item is StarterKitCollectionItem => item !== null);

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

export function parseStarterKitStateResponse(args: {
  text: string;
  targetCatalog: StarterKitExecutionTarget[];
}): {
  updates: StarterKitStateUpdate[];
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
    .filter((update): update is StarterKitStateUpdate => update !== null);

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
