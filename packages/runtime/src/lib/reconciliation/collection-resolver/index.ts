import type { CollectionNode } from '@continuum-dev/contract';
import { ISSUE_CODES, ISSUE_SEVERITY } from '@continuum-dev/contract';
import type { ReconciliationOptions } from '../../types.js';
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
import type { CollectionResolutionResult } from './types.js';

export {
  createInitialCollectionValue,
  normalizeCollectionValue,
  resolveCollectionDefaultValues,
};

export function reconcileCollectionValue(
  priorNode: CollectionNode,
  newNode: CollectionNode,
  priorValue: unknown,
  options: ReconciliationOptions
): CollectionResolutionResult {
  const issues: CollectionResolutionResult['issues'] = [];
  const normalized = normalizeCollectionValue(newNode, priorValue);

  if (
    priorNode.template.type !== newNode.template.type &&
    !areCompatibleContainerTypes(priorNode.template.type, newNode.template.type)
  ) {
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

  const receivedNewDefaults = receivedUpdatedDefaults(priorNode, newNode);
  if (receivedNewDefaults) {
    return resolveUpdatedDefaults(newNode, normalized, issues, priorValue);
  }

  let didMigrateItems = false;
  const priorPathMap = buildTemplatePathMap(priorNode.template);
  const newPathMap = buildTemplatePathMap(newNode.template);
  const shouldRemap = needsPathRemapping(priorPathMap, newPathMap);

  const migratedItems = normalized.value.items.map((item) => {
    const values = shouldRemap
      ? remapCollectionItemPaths(item.values, priorPathMap, newPathMap)
      : { ...item.values };

    if (shouldRemap && values !== item.values) {
      didMigrateItems = true;
    }

    const priorTemplateValue = values[priorNode.template.id];
    if (
      priorTemplateValue !== undefined &&
      hasTemplateHashChanged(priorNode.template, newNode.template)
    ) {
      const migrationResult = attemptMigration(
        priorNode.template.id,
        priorNode.template,
        newNode.template,
        priorTemplateValue,
        options
      );

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

  return {
    value: {
      ...normalized,
      value: {
        items: applyItemConstraints(
          migratedItems,
          newNode.minItems,
          newNode.maxItems,
          issues,
          newNode.id,
          newNode.template
        ),
      },
    },
    issues,
    didMigrateItems,
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

function resolveUpdatedDefaults(
  newNode: CollectionNode,
  normalized: ReturnType<typeof normalizeCollectionValue>,
  issues: CollectionResolutionResult['issues'],
  priorValue: unknown
): CollectionResolutionResult {
  const defaults = resolveCollectionDefaultValues(newNode);
  const constrainedItems = applyItemConstraints(
    defaults.value.items,
    newNode.minItems,
    newNode.maxItems,
    issues,
    newNode.id,
    newNode.template
  );

  if (hasProtectedItems((priorValue as { value?: unknown })?.value)) {
    return {
      value: {
        ...normalized,
        suggestion: { items: constrainedItems },
      },
      issues,
      didMigrateItems: true,
    };
  }

  const nextValue = {
    ...normalized,
    value: { items: constrainedItems },
  };
  delete nextValue.suggestion;

  return {
    value: nextValue,
    issues,
    didMigrateItems: true,
  };
}
