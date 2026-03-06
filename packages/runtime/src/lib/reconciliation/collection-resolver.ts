import type { CollectionNode, CollectionNodeState, NodeValue, ViewNode } from '@continuum/contract';
import { getChildNodes } from '@continuum/contract';
import { ISSUE_CODES, ISSUE_SEVERITY } from '@continuum/contract';
import type { ReconciliationIssue, ReconciliationOptions } from '../types.js';
import { attemptMigration } from './migrator.js';

const CONTAINER_TYPES = new Set(['row', 'grid', 'group']);

function areCompatibleContainerTypes(a: string, b: string): boolean {
  return CONTAINER_TYPES.has(a) && CONTAINER_TYPES.has(b);
}

interface CollectionResolutionResult {
  value: NodeValue<CollectionNodeState>;
  issues: ReconciliationIssue[];
  didMigrateItems: boolean;
}

export function resolveCollectionDefaultValues(node: CollectionNode): NodeValue<CollectionNodeState> {
  if (!node.defaultValues || !Array.isArray(node.defaultValues)) {
    return createInitialCollectionValue(node);
  }

  const { keyToPath } = buildTemplatePathMap(node.template);
  
  const items = node.defaultValues.map((defaultItem) => {
    const itemValues: Record<string, NodeValue> = {};
    
    // Fill in default values based on semantic keys provided in `defaultValues`
    for (const [key, value] of Object.entries(defaultItem)) {
      const path = keyToPath.get(key) || key; // If path not mapped, use key as path
      itemValues[path] = { value };
    }
    
    // Fill in missing fields with template defaults
    const templateDefaults = collectTemplateDefaults(node.template);
    for (const [path, defaultValue] of Object.entries(templateDefaults)) {
      if (!(path in itemValues)) {
        itemValues[path] = defaultValue;
      }
    }
    
    return { values: itemValues };
  });

  return { value: { items } };
}

export function createInitialCollectionValue(node: CollectionNode): NodeValue<CollectionNodeState> {
  if (node.defaultValues && Array.isArray(node.defaultValues)) {
    return resolveCollectionDefaultValues(node);
  }

  const minItems = normalizeMinItems(node.minItems);
  const items = Array.from({ length: minItems }, () => ({
    values: collectTemplateDefaults(node.template),
  }));
  return { value: { items } };
}

/**
 * Build a bidirectional mapping between node keys and their full relative paths
 * within a template tree. Used to remap collection item value paths when the AI
 * restructures template containers (renames IDs) while keeping the same keys.
 */
function buildTemplatePathMap(
  node: ViewNode,
  parentPath = ''
): { keyToPath: Map<string, string>; pathToKey: Map<string, string>; allPaths: Set<string> } {
  const keyToPath = new Map<string, string>();
  const pathToKey = new Map<string, string>();
  const allPaths = new Set<string>();

  function walk(n: ViewNode, parent: string): void {
    const nodePath = parent.length > 0 ? `${parent}/${n.id}` : n.id;
    allPaths.add(nodePath);
    const effectiveKey = n.key ?? n.id;
    // Only map the first occurrence of a key (no overwrites)
    if (!keyToPath.has(effectiveKey)) {
      keyToPath.set(effectiveKey, nodePath);
    }
    pathToKey.set(nodePath, effectiveKey);
    const children = getChildNodes(n);
    for (const child of children) {
      walk(child, nodePath);
    }
  }

  walk(node, parentPath);
  return { keyToPath, pathToKey, allPaths };
}

/**
 * Remap collection item value keys from old template paths to new template paths.
 * For each value key in the item:
 *   1. Look up what key (semantic name) that old path corresponded to
 *   2. Find the new path for that same key
 *   3. Move the value to the new path
 * Values that can't be remapped are kept under their original key.
 */
function remapCollectionItemPaths(
  oldValues: Record<string, NodeValue>,
  priorMap: { pathToKey: Map<string, string>; allPaths: Set<string> },
  newMap: { keyToPath: Map<string, string>; allPaths: Set<string> },
): Record<string, NodeValue> {
  const remapped: Record<string, NodeValue> = {};
  let hasChanges = false;

  for (const [oldPath, value] of Object.entries(oldValues)) {
    const semanticKey = priorMap.pathToKey.get(oldPath);
    if (semanticKey) {
      const newPath = newMap.keyToPath.get(semanticKey);
      if (newPath && newPath !== oldPath) {
        remapped[newPath] = value;
        hasChanges = true;
        continue;
      }
    }
    // If the old path exists in the new template, keep it as-is.
    // If it doesn't exist in either map, keep it as-is (legacy data).
    remapped[oldPath] = value;
  }

  return hasChanges ? remapped : oldValues;
}

/**
 * Determine whether the template structure has changed enough to warrant
 * path remapping. This is true when any node paths differ between the two
 * templates (container IDs changed, nodes reorganized, etc.)
 */
function needsPathRemapping(
  priorMap: { allPaths: Set<string> },
  newMap: { allPaths: Set<string> }
): boolean {
  if (priorMap.allPaths.size !== newMap.allPaths.size) return true;
  for (const path of priorMap.allPaths) {
    if (!newMap.allPaths.has(path)) return true;
  }
  return false;
}

export function reconcileCollectionValue(
  priorNode: CollectionNode,
  newNode: CollectionNode,
  priorValue: unknown,
  options: ReconciliationOptions
): CollectionResolutionResult {
  const issues: ReconciliationIssue[] = [];
  const normalized = normalizeCollectionValue(newNode, priorValue);
  if (priorNode.template.type !== newNode.template.type && !areCompatibleContainerTypes(priorNode.template.type, newNode.template.type)) {
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

  // Build path maps for key-based remapping
  const priorPathMap = buildTemplatePathMap(priorTemplate);
  const newPathMap = buildTemplatePathMap(newTemplate);
  const shouldRemap = needsPathRemapping(priorPathMap, newPathMap);

  // Check if AI pushed new defaultValues that differ from the prior ones
  let receivedNewDefaults = false;
  let hasDirtyItems = false;

  if (newNode.defaultValues !== undefined) {
    if (!priorNode.defaultValues || JSON.stringify(priorNode.defaultValues) !== JSON.stringify(newNode.defaultValues)) {
      receivedNewDefaults = true;
    }
  }

  // Determine if any prior item has dirty fields
  if (receivedNewDefaults && priorValue !== undefined) {
    const state = (priorValue as NodeValue<CollectionNodeState>).value;
    if (state && Array.isArray(state.items)) {
      hasDirtyItems = state.items.some(item => 
        item.values && Object.values(item.values).some(v => v.isDirty)
      );
    }
  }

  // If AI provided new defaultValues, populate those instead
  if (receivedNewDefaults) {
    const defaultCollection = resolveCollectionDefaultValues(newNode);
    const constrained = applyItemConstraints(
      defaultCollection.value.items,
      newNode.minItems,
      newNode.maxItems,
      issues,
      newNode.id,
      newNode.template
    );

    // If there were dirty items, return the new defaults as a `suggestion` for the whole collection
    if (hasDirtyItems) {
      const suggestedValue: NodeValue<CollectionNodeState> = {
        value: normalized.value, // keep prior as current
        suggestion: { items: constrained } // new items as suggestion
      };
      // Keep isDirty flag from prior NodeValue if it exists
      if ((normalized as any).isDirty) {
        suggestedValue.isDirty = true;
      }
      return {
        value: suggestedValue,
        issues,
        didMigrateItems: true, // Treat as migration to force UI update
      };
    }

    // If no dirty items, immediately overwrite
    return {
      value: { value: { items: constrained } },
      issues,
      didMigrateItems: true,
    };
  }

  const migratedItems = normalized.value.items.map((item) => {
    // Step 1: Remap value paths from old template structure to new
    const values = shouldRemap
      ? remapCollectionItemPaths(item.values, priorPathMap, newPathMap)
      : { ...item.values };

    if (shouldRemap && values !== item.values) {
      didMigrateItems = true;
    }

    // Step 2: Handle hash-based migration for the template root value
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

  const constrained = applyItemConstraints(
    migratedItems,
    newNode.minItems,
    newNode.maxItems,
    issues,
    newNode.id,
    newNode.template
  );
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
  nodeId: string,
  template: ViewNode
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
    constrained.push({ values: collectTemplateDefaults(template) });
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

function collectTemplateDefaults(
  node: ViewNode,
  parentPath = ''
): Record<string, NodeValue> {
  const nodeId = parentPath.length > 0 ? `${parentPath}/${node.id}` : node.id;
  if (node.type === 'collection') {
    return {
      [nodeId]: createInitialCollectionValue(node),
    };
  }
  const values: Record<string, NodeValue> = {};
  if ('defaultValue' in node && node.defaultValue !== undefined) {
    values[nodeId] = { value: node.defaultValue };
  }
  const children = getChildNodes(node);
  for (const child of children) {
    Object.assign(values, collectTemplateDefaults(child, nodeId));
  }
  return values;
}
