import type { DataSnapshot, DetachedValue, NodeValue, ViewNode } from '@continuum/contract';
import { ISSUE_CODES, ISSUE_SEVERITY } from '@continuum/contract';
import type {
  NodeResolutionAccumulator,
  ReconciliationIssue,
  ReconciliationOptions,
  StateDiff,
} from '../types.js';
import type { ReconciliationContext } from '../context.js';
import {
  findPriorNode,
  determineNodeMatchStrategy,
  findNewNodeByPriorNode,
  resolvePriorSnapshotId,
} from '../context.js';
import {
  addedDiff,
  addedResolution,
  typeChangedDiff,
  detachedResolution,
  migratedDiff,
  migratedResolution,
  carriedResolution,
  removedDiff,
  restoredDiff,
  restoredResolution,
} from './differ.js';
import { attemptMigration } from './migrator.js';
import { carryValuesMeta } from './state-builder.js';
import { validateNodeValue } from './validator.js';
import { createInitialCollectionValue, reconcileCollectionValue } from './collection-resolver.js';

export function resolveAllNodes(
  ctx: ReconciliationContext,
  priorValues: Map<string, unknown>,
  priorData: DataSnapshot,
  now: number,
  options: ReconciliationOptions
): NodeResolutionAccumulator {
  const acc: NodeResolutionAccumulator = {
    values: {},
    valueLineage: {},
    detachedValues: {},
    restoredDetachedKeys: new Set<string>(),
    diffs: [],
    resolutions: [],
    issues: [],
  };

  for (const [newId, newNode] of ctx.newById) {
    const priorNode = findPriorNode(ctx, newNode);
    const priorNodeId = priorNode ? (ctx.priorNodeIds.get(priorNode) ?? priorNode.id) : null;
    const matchedBy = determineNodeMatchStrategy(ctx, newNode, priorNode);
    const carriedPriorValue = priorValues.get(newId);
    const shouldTreatAsAdded = matchedBy === 'key' && carriedPriorValue === undefined;
    const priorValue = matchedBy === 'key'
      ? carriedPriorValue
      : carriedPriorValue ?? (priorNodeId ? priorData.values[priorNodeId] : undefined);

    if (!priorNode || shouldTreatAsAdded) {
      resolveNewNode(acc, newId, newNode, priorData, now);
    } else if (newNode.type === 'collection' && priorNode.type === 'collection') {
      resolveCollectionNode(
        acc,
        newId,
        priorNode,
        priorNodeId!,
        newNode,
        matchedBy,
        priorValue,
        priorData,
        now,
        options
      );
    } else if (priorNode.type !== newNode.type && !areCompatibleContainerTypes(priorNode.type, newNode.type)) {
      resolveTypeMismatchedNode(
        acc,
        newId,
        priorNode,
        priorNodeId!,
        newNode,
        matchedBy,
        priorValue,
        ctx,
        now
      );
    } else if (hasNodeHashChanged(priorNode, newNode)) {
      resolveHashChangedNode(
        acc,
        newId,
        priorNode,
        priorNodeId!,
        newNode,
        matchedBy,
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
        priorNodeId!,
        newNode,
        matchedBy as 'id' | 'key',
        priorValue,
        priorData,
        now
      );
    }

    acc.issues.push(
      ...validateNodeValue(
        newNode,
        acc.values[newId] as NodeValue | undefined
      )
    );
  }

  return acc;
}

function resolveNewNode(
  acc: NodeResolutionAccumulator,
  newId: string,
  newNode: ViewNode,
  priorData: DataSnapshot,
  now: number
): void {
  const detachedKey = newNode.key ?? newId;
  const detachedValue = priorData.detachedValues?.[detachedKey];
  if (detachedValue && detachedValue.previousNodeType === newNode.type) {
    acc.values[newId] = detachedValue.value as NodeValue;
    acc.restoredDetachedKeys.add(detachedKey);
    acc.diffs.push(restoredDiff(newId, detachedValue.value));
    acc.resolutions.push(restoredResolution(newId, newNode.type, detachedValue.value));
    return;
  }
  if (newNode.type === 'collection') {
    acc.values[newId] = createInitialCollectionValue(newNode);
  } else if ('defaultValue' in newNode && newNode.defaultValue !== undefined) {
    acc.values[newId] = { value: newNode.defaultValue };
  }
  acc.diffs.push(addedDiff(newId));
  acc.resolutions.push(addedResolution(newId, newNode.type));
}

function resolveCollectionNode(
  acc: NodeResolutionAccumulator,
  newId: string,
  priorNode: Extract<ViewNode, { type: 'collection' }>,
  priorNodeId: string,
  newNode: Extract<ViewNode, { type: 'collection' }>,
  matchedBy: 'id' | 'key' | null,
  priorValue: unknown,
  priorData: DataSnapshot,
  now: number,
  options: ReconciliationOptions
): void {
  const result = reconcileCollectionValue(priorNode, newNode, priorValue, options);
  acc.values[newId] = result.value;
  carryValuesMeta(acc.valueLineage, newId, priorNodeId, priorData, now, result.didMigrateItems);
  acc.issues.push(...result.issues);
  if (result.didMigrateItems) {
    acc.diffs.push(migratedDiff(newId, priorValue, result.value));
    acc.resolutions.push(
      migratedResolution(
        newId,
        priorNodeId,
        matchedBy ?? 'id',
        priorNode.type,
        newNode.type,
        priorValue,
        result.value
      )
    );
    return;
  }
  acc.resolutions.push(
    carriedResolution(
      newId,
      priorNodeId,
      matchedBy ?? 'id',
      priorNode.type,
      priorValue,
      result.value
    )
  );
}

function resolveTypeMismatchedNode(
  acc: NodeResolutionAccumulator,
  newId: string,
  priorNode: ViewNode,
  priorNodeId: string,
  newNode: ViewNode,
  matchedBy: 'id' | 'key' | null,
  priorValue: unknown,
  ctx: ReconciliationContext,
  now: number
): void {
  acc.issues.push({
    severity: ISSUE_SEVERITY.ERROR,
    nodeId: newId,
    message: `Node type mismatch: ${priorNode.type} -> ${newNode.type}`,
    code: ISSUE_CODES.TYPE_MISMATCH,
  });
  acc.diffs.push(typeChangedDiff(newId, priorValue, priorNode.type, newNode.type));
  acc.resolutions.push(detachedResolution(newId, priorNodeId, matchedBy, priorNode.type, newNode.type, priorValue));
  if (priorValue !== undefined) {
    const detachedKey = priorNode.key ?? priorNodeId;
    acc.detachedValues[detachedKey] = {
      value: priorValue as NodeValue,
      previousNodeType: priorNode.type,
      key: priorNode.key,
      detachedAt: now,
      viewVersion: ctx.priorView?.version ?? 'unknown',
      reason: 'type-mismatch',
    };
  }
}

/**
 * Container types (row, grid, group) are semantically equivalent — they all
 * hold children. The AI may swap between them for styling reasons. Treating
 * these as type mismatches would destroy all child values unnecessarily.
 */
const CONTAINER_TYPES = new Set(['row', 'grid', 'group']);

function areCompatibleContainerTypes(a: string, b: string): boolean {
  return CONTAINER_TYPES.has(a) && CONTAINER_TYPES.has(b);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function areDefaultValuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
      return false;
    }
    for (let i = 0; i < a.length; i += 1) {
      if (!areDefaultValuesEqual(a[i], b[i])) {
        return false;
      }
    }
    return true;
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const aKeys = Object.keys(a).sort();
    const bKeys = Object.keys(b).sort();
    if (aKeys.length !== bKeys.length) {
      return false;
    }
    for (let i = 0; i < aKeys.length; i += 1) {
      const key = aKeys[i];
      if (key !== bKeys[i] || !areDefaultValuesEqual(a[key], b[key])) {
        return false;
      }
    }
    return true;
  }
  return false;
}

function hasNodeHashChanged(
  priorNode: ViewNode,
  newNode: ViewNode
): boolean {
  return !!(priorNode.hash && newNode.hash && priorNode.hash !== newNode.hash);
}

function resolveHashChangedNode(
  acc: NodeResolutionAccumulator,
  newId: string,
  priorNode: ViewNode,
  priorNodeId: string,
  newNode: ViewNode,
  matchedBy: 'id' | 'key' | null,
  priorValue: unknown,
  priorData: DataSnapshot,
  now: number,
  options: ReconciliationOptions
): void {
  const migrationResult = attemptMigration(newId, priorNode, newNode, priorValue, options);

  if (migrationResult.kind === 'migrated') {
    acc.values[newId] = migrationResult.value as NodeValue;
    carryValuesMeta(acc.valueLineage, newId, priorNodeId, priorData, now, true);
    acc.diffs.push(migratedDiff(newId, priorValue, migrationResult.value));
    acc.resolutions.push(
      migratedResolution(
        newId,
        priorNodeId,
        matchedBy,
        priorNode.type,
        newNode.type,
        priorValue,
        migrationResult.value
      )
    );
    return;
  }

  const message = migrationResult.kind === 'error'
    ? `Node ${newId} migration failed: ${String(migrationResult.error)}`
    : `Node ${newId} view changed but no migration strategy available`;

  acc.issues.push({
    severity: ISSUE_SEVERITY.WARNING,
    nodeId: newId,
    message,
    code: ISSUE_CODES.MIGRATION_FAILED,
  });

  resolveUnchangedNode(
    acc,
    newId,
    priorNode,
    priorNodeId,
    newNode,
    matchedBy as 'id' | 'key',
    priorValue,
    priorData,
    now
  );
}

function resolveUnchangedNode(
  acc: NodeResolutionAccumulator,
  newId: string,
  priorNode: ViewNode,
  priorNodeId: string,
  newNode: ViewNode,
  matchedBy: 'id' | 'key',
  priorValue: unknown,
  priorData: DataSnapshot,
  now: number
): void {
  let reconciledValue: NodeValue | undefined = priorValue !== undefined ? (priorValue as NodeValue) : undefined;
  let didApplyDefaultChange = false;
  if (priorValue !== undefined) {
    const priorNodeValue = priorValue as NodeValue;
    const resolvedValue = { ...priorNodeValue };
    const canApplyDefaultChange =
      newId === priorNodeId ||
      (newNode.key !== undefined && newNode.key === priorNode.key);
    
    if (canApplyDefaultChange && 'defaultValue' in newNode && newNode.defaultValue !== undefined) {
      if ('defaultValue' in priorNode) {
        if (!areDefaultValuesEqual(priorNode.defaultValue, newNode.defaultValue)) {
          didApplyDefaultChange = true;
          if (priorNodeValue.isDirty) {
            resolvedValue.suggestion = newNode.defaultValue;
          } else {
            resolvedValue.value = newNode.defaultValue;
          }
        }
      } else {
        didApplyDefaultChange = true;
        if (priorNodeValue.isDirty) {
          resolvedValue.suggestion = newNode.defaultValue;
        } else {
          resolvedValue.value = newNode.defaultValue;
        }
      }
    }

    acc.values[newId] = resolvedValue;
    reconciledValue = resolvedValue;
    carryValuesMeta(acc.valueLineage, newId, priorNodeId, priorData, now, false);
    if (didApplyDefaultChange) {
      acc.diffs.push(migratedDiff(newId, priorValue, resolvedValue));
    }
  }

  acc.resolutions.push(carriedResolution(
    newId,
    priorNodeId,
    matchedBy,
    priorNode.type,
    priorValue,
    reconciledValue
  ));
}

export function detectRemovedNodes(
  ctx: ReconciliationContext,
  priorData: DataSnapshot,
  options: ReconciliationOptions,
  now: number
): { diffs: StateDiff[]; issues: ReconciliationIssue[]; detachedValues: Record<string, DetachedValue> } {
  const diffs: StateDiff[] = [];
  const issues: ReconciliationIssue[] = [];
  const detachedValues: Record<string, DetachedValue> = {};

  for (const [priorId, priorValue] of Object.entries(priorData.values)) {
    const resolvedPriorId = resolvePriorSnapshotId(ctx, priorId) ?? priorId;
    const priorComp = ctx.priorById.get(resolvedPriorId);
    const keyMatchedNode = priorComp ? findNewNodeByPriorNode(ctx, priorComp) : null;
    const stillExists =
      ctx.newById.has(resolvedPriorId) ||
      !!keyMatchedNode;

    if (!stillExists) {
      diffs.push(removedDiff(resolvedPriorId, priorValue));
      if (priorValue !== undefined) {
        const detachedKey = priorComp?.key ?? resolvedPriorId;
        detachedValues[detachedKey] = {
          value: priorValue as NodeValue,
          previousNodeType: priorComp?.type ?? 'unknown',
          key: priorComp?.key,
          detachedAt: now,
          viewVersion: ctx.priorView?.version ?? 'unknown',
          reason: 'node-removed',
        };
      }
      if (!options.allowPartialRestore) {
        issues.push({
          severity: ISSUE_SEVERITY.WARNING,
          nodeId: resolvedPriorId,
          message: `Node ${resolvedPriorId} was removed from view`,
          code: ISSUE_CODES.NODE_REMOVED,
        });
      }
    }
  }

  return { diffs, issues, detachedValues };
}
