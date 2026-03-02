import type { CollectionNode, CollectionNodeState, NodeValue, ViewNode } from '@continuum/contract';
import { ISSUE_CODES, ISSUE_SEVERITY } from '@continuum/contract';
import type { ReconciliationIssue, ReconciliationOptions } from '../types.js';
import { attemptMigration } from './migrator.js';

interface CollectionResolutionResult {
  value: NodeValue<CollectionNodeState>;
  issues: ReconciliationIssue[];
  didMigrateItems: boolean;
}

export function createInitialCollectionValue(node: CollectionNode): NodeValue<CollectionNodeState> {
  const minItems = normalizeMinItems(node.minItems);
  const items = Array.from({ length: minItems }, () => ({ values: {} as Record<string, NodeValue> }));
  return { value: { items } };
}

export function reconcileCollectionValue(
  priorNode: CollectionNode,
  newNode: CollectionNode,
  priorValue: unknown,
  options: ReconciliationOptions
): CollectionResolutionResult {
  const issues: ReconciliationIssue[] = [];
  const normalized = normalizeCollectionValue(newNode, priorValue);
  if (priorNode.template.type !== newNode.template.type) {
    issues.push({
      severity: ISSUE_SEVERITY.ERROR,
      nodeId: newNode.id,
      message: `Node type mismatch: ${priorNode.template.type} -> ${newNode.template.type}`,
      code: ISSUE_CODES.TYPE_MISMATCH,
    });
    return {
      value: createInitialCollectionValue(newNode),
      issues,
      didMigrateItems: false,
    };
  }

  let didMigrateItems = false;
  const priorTemplate = priorNode.template;
  const newTemplate = newNode.template;
  const migratedItems = normalized.value.items.map((item) => {
    const values = { ...item.values };
    const priorTemplateValue = values[priorTemplate.id];
    if (priorTemplateValue !== undefined && hasTemplateHashChanged(priorTemplate, newTemplate)) {
      const migrationResult = attemptMigration(
        priorTemplate.id,
        priorTemplate,
        newTemplate,
        priorTemplateValue,
        options
      );
      if (migrationResult.kind === 'migrated') {
        didMigrateItems = true;
        values[newTemplate.id] = migrationResult.value as NodeValue;
        if (newTemplate.id !== priorTemplate.id) {
          delete values[priorTemplate.id];
        }
      } else if (migrationResult.kind === 'error') {
        issues.push({
          severity: ISSUE_SEVERITY.WARNING,
          nodeId: newNode.id,
          message: `Node ${newNode.id} migration failed: ${String(migrationResult.error)}`,
          code: ISSUE_CODES.MIGRATION_FAILED,
        });
      } else {
        issues.push({
          severity: ISSUE_SEVERITY.WARNING,
          nodeId: newNode.id,
          message: `Node ${newNode.id} view changed but no migration strategy available`,
          code: ISSUE_CODES.MIGRATION_FAILED,
        });
      }
    }
    return { values };
  });

  const constrained = applyItemConstraints(migratedItems, newNode.minItems, newNode.maxItems, issues, newNode.id);
  return {
    value: { value: { items: constrained } },
    issues,
    didMigrateItems,
  };
}

export function normalizeCollectionValue(
  node: CollectionNode,
  value: unknown
): NodeValue<CollectionNodeState> {
  if (!value || typeof value !== 'object' || !('value' in (value as Record<string, unknown>))) {
    return createInitialCollectionValue(node);
  }
  const state = (value as NodeValue).value as { items?: Array<{ values?: Record<string, NodeValue> }> };
  const items = Array.isArray(state?.items)
    ? state.items.map((item) => ({ values: (item?.values ?? {}) as Record<string, NodeValue> }))
    : [];
  return { value: { items } };
}

function applyItemConstraints(
  items: Array<{ values: Record<string, NodeValue> }>,
  minItems: number | undefined,
  maxItems: number | undefined,
  issues: ReconciliationIssue[],
  nodeId: string
): Array<{ values: Record<string, NodeValue> }> {
  let constrained = [...items];
  const min = normalizeMinItems(minItems);
  const max = normalizeMaxItems(maxItems);
  if (max !== undefined && constrained.length > max) {
    constrained = constrained.slice(0, max);
    issues.push({
      severity: ISSUE_SEVERITY.WARNING,
      nodeId,
      message: `Collection ${nodeId} exceeded maxItems`,
      code: ISSUE_CODES.COLLECTION_CONSTRAINT_VIOLATED,
    });
  }
  while (constrained.length < min) {
    constrained.push({ values: {} });
    issues.push({
      severity: ISSUE_SEVERITY.INFO,
      nodeId,
      message: `Collection ${nodeId} filled to minItems`,
      code: ISSUE_CODES.COLLECTION_CONSTRAINT_VIOLATED,
    });
  }
  return constrained;
}

function normalizeMinItems(value: number | undefined): number {
  if (value === undefined || value < 0) {
    return 0;
  }
  return Math.floor(value);
}

function normalizeMaxItems(value: number | undefined): number | undefined {
  if (value === undefined || value < 0) {
    return undefined;
  }
  return Math.floor(value);
}

function hasTemplateHashChanged(priorTemplate: ViewNode, newTemplate: ViewNode): boolean {
  return !!(priorTemplate.hash && newTemplate.hash && priorTemplate.hash !== newTemplate.hash);
}
