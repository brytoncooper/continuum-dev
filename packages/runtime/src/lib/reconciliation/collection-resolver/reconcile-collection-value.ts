import type { CollectionNode, NodeValue } from '@continuum-dev/contract';
import { ISSUE_CODES, ISSUE_SEVERITY } from '@continuum-dev/contract';
import { attemptMigration } from '../migrator/index.js';
import { applyItemConstraints } from './constraints.js';
import {
  createInitialCollectionValue,
  resolveCollectionDefaultValues,
} from './defaults.js';
import {
  areCompatibleContainerTypes,
  hasProtectedItems,
  hasTemplateHashChanged,
  normalizeCollectionValue,
} from './normalization.js';
import {
  buildTemplatePathMap,
  needsPathRemapping,
  remapCollectionItemPaths,
} from './template-paths.js';
import type {
  CollectionReconcileInput,
  CollectionResolutionResult,
  ResolveUpdatedDefaultsInput,
} from './types.js';

export function reconcileCollectionValue(
  input: CollectionReconcileInput
): CollectionResolutionResult {
  const { priorNode, newNode, priorValue, options } = input;
  const issues: CollectionResolutionResult['issues'] = [];
  const normalized = normalizeCollectionValue(newNode, priorValue);

  const incompatibleTemplateRootType =
    priorNode.template.type !== newNode.template.type &&
    !areCompatibleContainerTypes(priorNode.template.type, newNode.template.type);
  if (incompatibleTemplateRootType) {
    return createTypeMismatchResult(priorNode, newNode, issues);
  }

  const receivedNewDefaults = receivedUpdatedDefaults(priorNode, newNode);
  if (receivedNewDefaults) {
    return resolveUpdatedDefaults({
      newNode,
      normalizedValue: normalized,
      issues,
      priorValue,
    });
  }

  const migration = resolveMigratedItems({
    priorNode,
    newNode,
    normalizedItems: normalized.value.items,
    options,
    issues,
  });

  return {
    value: {
      ...normalized,
      value: {
        items: applyItemConstraints({
          items: migration.items,
          minItems: newNode.minItems,
          maxItems: newNode.maxItems,
          issues,
          nodeId: newNode.id,
          template: newNode.template,
        }),
      },
    },
    issues,
    didMigrateItems: migration.didMigrateItems,
  };
}

function receivedUpdatedDefaults(
  priorNode: CollectionNode,
  newNode: CollectionNode
): boolean {
  if (newNode.defaultValues === undefined) {
    return false;
  }

  return (
    !priorNode.defaultValues ||
    JSON.stringify(priorNode.defaultValues) !==
      JSON.stringify(newNode.defaultValues)
  );
}

function createTypeMismatchResult(
  priorNode: CollectionNode,
  newNode: CollectionNode,
  issues: CollectionResolutionResult['issues']
): CollectionResolutionResult {
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

function resolveUpdatedDefaults(
  input: ResolveUpdatedDefaultsInput
): CollectionResolutionResult {
  const { newNode, normalizedValue, issues, priorValue } = input;
  const defaults = resolveCollectionDefaultValues(newNode);
  const constrainedItems = applyItemConstraints({
    items: defaults.value.items,
    minItems: newNode.minItems,
    maxItems: newNode.maxItems,
    issues,
    nodeId: newNode.id,
    template: newNode.template,
  });

  if (hasProtectedItems((priorValue as { value?: unknown })?.value)) {
    return {
      value: {
        ...normalizedValue,
        suggestion: { items: constrainedItems },
      },
      issues,
      didMigrateItems: true,
    };
  }

  const nextValue = {
    ...normalizedValue,
    value: { items: constrainedItems },
  };
  delete nextValue.suggestion;

  return {
    value: nextValue,
    issues,
    didMigrateItems: true,
  };
}

function resolveMigratedItems(input: {
  priorNode: CollectionNode;
  newNode: CollectionNode;
  normalizedItems: Array<{ values: Record<string, NodeValue> }>;
  options: CollectionReconcileInput['options'];
  issues: CollectionResolutionResult['issues'];
}): {
  items: Array<{ values: Record<string, NodeValue> }>;
  didMigrateItems: boolean;
} {
  const { priorNode, newNode, normalizedItems, options, issues } = input;
  const priorPathMap = buildTemplatePathMap(priorNode.template);
  const newPathMap = buildTemplatePathMap(newNode.template);
  const shouldRemap = needsPathRemapping(priorPathMap, newPathMap);
  const templateHashChanged = hasTemplateHashChanged(
    priorNode.template,
    newNode.template
  );

  let didMigrateItems = false;
  const items = normalizedItems.map((item) => {
    const values = shouldRemap
      ? remapCollectionItemPaths(item.values, priorPathMap, newPathMap)
      : { ...item.values };

    if (shouldRemap && values !== item.values) {
      didMigrateItems = true;
    }

    const priorTemplateValue = values[priorNode.template.id];
    if (priorTemplateValue !== undefined && templateHashChanged) {
      const migrationResult = attemptMigration({
        nodeId: priorNode.template.id,
        priorNode: priorNode.template,
        newNode: newNode.template,
        priorValue: priorTemplateValue,
        options,
      });

      if (migrationResult.kind === 'migrated') {
        didMigrateItems = true;
        values[newNode.template.id] = migrationResult.value as typeof priorTemplateValue;
        if (newNode.template.id !== priorNode.template.id) {
          delete values[priorNode.template.id];
        }
      } else {
        issues.push({
          severity: ISSUE_SEVERITY.WARNING,
          nodeId: newNode.id,
          message:
            migrationResult.kind === 'error'
              ? `Node ${newNode.id} migration failed: ${String(
                  migrationResult.error
                )}`
              : `Node ${newNode.id} view changed but no migration strategy available`,
          code: ISSUE_CODES.MIGRATION_FAILED,
        });
      }
    }

    return { values };
  });

  return { items, didMigrateItems };
}
