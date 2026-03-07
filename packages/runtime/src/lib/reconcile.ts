import type {
  CollectionNode,
  CollectionNodeState,
  DataSnapshot,
  DetachedValue,
  NodeValue,
  ViewDefinition,
  ViewNode,
} from '@continuum/contract';
import { getChildNodes } from '@continuum/contract';
import { DATA_RESOLUTIONS } from '@continuum/contract';
import type { NodeResolutionAccumulator, ReconciliationOptions, ReconciliationResult, StateDiff } from './types.js';
import type { ReconciliationContext } from './context.js';
import { buildReconciliationContext, buildPriorValueLookupByIdAndKey } from './context.js';
import { buildFreshSessionResult, buildBlindCarryResult, assembleReconciliationResult } from './reconciliation/state-builder.js';
import { resolveAllNodes, detectRemovedNodes } from './reconciliation/node-resolver.js';
import { migratedDiff, restoredDiff, restoredResolution } from './reconciliation/differ.js';
import { createInitialCollectionValue } from './reconciliation/collection-resolver.js';

/**
 * Reconciles user state across view mutations produced by AI or server-side layout changes.
 *
 * This is the main runtime entrypoint. Provide the new view plus optional prior view/data,
 * and the runtime returns a deterministic result with merged state, diffs, issue diagnostics,
 * and per-node resolutions.
 *
 * @param newView Current view definition to reconcile into.
 * @param priorView Previous view definition. Pass null for first render or unknown history.
 * @param priorData Previous data snapshot. Pass null for fresh sessions.
 * @param options Optional reconciliation behavior flags and migration extension hooks.
 * @returns The reconciled state and reconciliation metadata for this transition.
 */
export function reconcile(
  newView: ViewDefinition,
  priorView: ViewDefinition | null,
  priorData: DataSnapshot | null,
  options: ReconciliationOptions = {}
): ReconciliationResult {
  const now = options.clock
    ? options.clock()
    : priorData
      ? priorData.lineage.timestamp + 1
      : Date.now();

  if (!priorData) {
    return buildFreshSessionResult(newView, now);
  }

  if (!priorView) {
    return buildBlindCarryResult(newView, priorData, now, options);
  }

  return reconcileViewTransition(newView, priorView, priorData, now, options);
}

/**
 * After resolving new nodes and detecting removals, check whether any nodes
 * resolved as "added" (no prior match) can be restored from values that were
 * just detached in the same push. This closes the gap where renaming both
 * a node's ID and key in a single pushView would lose data until the next push.
 */
function restoreFromSamePushDetachments(
  resolved: NodeResolutionAccumulator,
  removals: { diffs: StateDiff[]; detachedValues?: Record<string, DetachedValue> },
  ctx: ReconciliationContext
): void {
  const justDetached = removals.detachedValues;
  if (!justDetached || Object.keys(justDetached).length === 0) {
    return;
  }

  for (let i = 0; i < resolved.resolutions.length; i++) {
    const resolution = resolved.resolutions[i];
    if (resolution.resolution !== DATA_RESOLUTIONS.ADDED) {
      continue;
    }

    const nodeId = resolution.nodeId;
    const newNode = ctx.newById.get(nodeId);
    if (!newNode) {
      continue;
    }

    let detachedKey = newNode.key ?? nodeId;
    let detachedEntry = justDetached[detachedKey];
    if (!detachedEntry && newNode.key?.includes('.')) {
      const suffix = newNode.key.split('.').at(-1);
      if (suffix) {
        detachedKey = suffix;
        detachedEntry = justDetached[detachedKey];
      }
    }
    if (!detachedEntry) {
      continue;
    }

    if (detachedEntry.previousNodeType !== newNode.type) {
      continue;
    }

    resolved.values[nodeId] = detachedEntry.value as NodeValue;
    resolved.restoredDetachedKeys.add(detachedKey);
    const addedDiffIndex = resolved.diffs.findIndex(
      (diff) => diff.nodeId === nodeId && diff.type === 'added'
    );
    if (addedDiffIndex !== -1) {
      resolved.diffs.splice(addedDiffIndex, 1);
    }
    resolved.diffs.push(restoredDiff(nodeId, detachedEntry.value));
    resolved.resolutions[i] = restoredResolution(nodeId, newNode.type, detachedEntry.value);
  }
}

function reconcileViewTransition(
  newView: ViewDefinition,
  priorView: ViewDefinition,
  priorData: DataSnapshot,
  now: number,
  options: ReconciliationOptions
): ReconciliationResult {
  const ctx = buildReconciliationContext(newView, priorView);
  const priorValues = buildPriorValueLookupByIdAndKey(priorData, ctx);
  const resolved = resolveAllNodes(ctx, priorValues, priorData, now, options);
  const removals = detectRemovedNodes(ctx, priorData, options, now);
  restoreFromSamePushDetachments(resolved, removals, ctx);
  resolveCrossLevelMigrations(ctx, priorData, resolved);
  const result = assembleReconciliationResult(resolved, removals, priorData, newView, now);
  result.issues.unshift(...ctx.issues);
  return result;
}

type CrossLevelMode = 'semantic' | 'key';
type StructuralLevel = 'top' | 'collection';

interface NodeLocation {
  mode: CrossLevelMode;
  token: string;
  node: ViewNode;
  nodeId: string;
  level: StructuralLevel;
  outerCollectionId?: string;
  pathChain?: string[];
}

interface TraverseFrame {
  node: ViewNode;
  nodeId: string;
  inCollection: boolean;
  outerCollectionId?: string;
  relativePath?: string;
  collectionPathStack: string[];
}

function resolveCrossLevelMigrations(
  ctx: ReconciliationContext,
  priorData: DataSnapshot,
  resolved: NodeResolutionAccumulator
): void {
  const priorLocations = collectLocations(ctx.priorView?.nodes ?? []);
  const newLocations = collectLocations(ctx.newView.nodes);
  applyTopToCollection('semantic', priorLocations, newLocations, priorData, ctx, resolved);
  applyCollectionToTop('semantic', priorLocations, newLocations, priorData, ctx, resolved);
  applyTopToCollection('key', priorLocations, newLocations, priorData, ctx, resolved);
  applyCollectionToTop('key', priorLocations, newLocations, priorData, ctx, resolved);
}

function collectLocations(nodes: ViewNode[]): NodeLocation[] {
  const locations: NodeLocation[] = [];
  const stack: TraverseFrame[] = nodes
    .map((node) => ({
      node,
      nodeId: node.id,
      inCollection: false,
      collectionPathStack: [],
    }))
    .reverse();

  while (stack.length > 0) {
    const frame = stack.pop();
    if (!frame) {
      continue;
    }
    const semanticKey = frame.node.semanticKey;
    const key = frame.node.key;
    if (semanticKey !== undefined && semanticKey.length > 0) {
      locations.push(buildLocation(frame, 'semantic', semanticKey));
    } else if (key) {
      locations.push(buildLocation(frame, 'key', key));
    }

    const children = getChildNodes(frame.node);
    for (let i = children.length - 1; i >= 0; i -= 1) {
      const child = children[i];
      const childNodeId = `${frame.nodeId}/${child.id}`;
      if (frame.node.type === 'collection') {
        const outerCollectionId = frame.inCollection ? frame.outerCollectionId : frame.nodeId;
        const relativePath = frame.inCollection
          ? `${frame.relativePath}/${child.id}`
          : child.id;
        const collectionPathStack = frame.inCollection
          ? frame.collectionPathStack
          : [''];
        stack.push({
          node: child,
          nodeId: childNodeId,
          inCollection: true,
          outerCollectionId,
          relativePath,
          collectionPathStack,
        });
        continue;
      }

      if (frame.inCollection) {
        const relativePath = `${frame.relativePath}/${child.id}`;
        const collectionPathStack = child.type === 'collection'
          ? [...frame.collectionPathStack, relativePath]
          : frame.collectionPathStack;
        stack.push({
          node: child,
          nodeId: childNodeId,
          inCollection: true,
          outerCollectionId: frame.outerCollectionId,
          relativePath,
          collectionPathStack,
        });
      } else {
        stack.push({
          node: child,
          nodeId: childNodeId,
          inCollection: false,
          collectionPathStack: [],
        });
      }
    }
  }
  return locations;
}

function buildLocation(frame: TraverseFrame, mode: CrossLevelMode, token: string): NodeLocation {
  if (!frame.inCollection) {
    return {
      mode,
      token,
      node: frame.node,
      nodeId: frame.nodeId,
      level: 'top',
    };
  }
  const chain = buildPathChain(frame.relativePath ?? '', frame.collectionPathStack);
  return {
    mode,
    token,
    node: frame.node,
    nodeId: frame.nodeId,
    level: 'collection',
    outerCollectionId: frame.outerCollectionId,
    pathChain: chain,
  };
}

function buildPathChain(relativePath: string, collectionPathStack: string[]): string[] {
  const chain: string[] = [];
  for (const path of collectionPathStack.slice(1)) {
    chain.push(path);
  }
  const anchor = collectionPathStack.length > 0 ? collectionPathStack[collectionPathStack.length - 1] : '';
  const finalPath = anchor.length > 0 && relativePath.startsWith(`${anchor}/`)
    ? relativePath.slice(anchor.length + 1)
    : relativePath;
  if (finalPath.length > 0 && chain[chain.length - 1] !== finalPath) {
    chain.push(finalPath);
  }
  return chain;
}

function applyTopToCollection(
  mode: CrossLevelMode,
  priorLocations: NodeLocation[],
  newLocations: NodeLocation[],
  priorData: DataSnapshot,
  ctx: ReconciliationContext,
  resolved: NodeResolutionAccumulator
): void {
  const priorTop = priorLocations.filter((loc) => loc.mode === mode && loc.level === 'top');
  const newTop = newLocations.filter((loc) => loc.mode === mode && loc.level === 'top');
  const newCollection = newLocations.filter((loc) => loc.mode === mode && loc.level === 'collection');
  const alreadyMigrated = new Set<string>();

  for (const source of priorTop) {
    if (!isRemovedFromLevel(source, newTop)) {
      continue;
    }
    const sourceValue = readTopLevelValue(priorData, source.nodeId, source.node.id);
    if (!sourceValue) {
      continue;
    }
    const targets = newCollection
      .filter((loc) => loc.token === source.token)
      .sort((a, b) => a.nodeId.localeCompare(b.nodeId));
    for (const target of targets) {
      if (!target.outerCollectionId || !target.pathChain || target.pathChain.length === 0) {
        continue;
      }
      const outerCollection = ctx.newById.get(target.outerCollectionId);
      if (!outerCollection || outerCollection.type !== 'collection') {
        continue;
      }
      if (target.node.type !== source.node.type) {
        resolved.values[target.outerCollectionId] = clearCollectionTargetValue(
          resolved.values[target.outerCollectionId],
          outerCollection,
          target.pathChain
        );
        if (mode === 'key' && resolved.values[source.nodeId] === undefined) {
          resolved.values[source.nodeId] = cloneNodeValue(sourceValue);
        }
        continue;
      }
      const updated = updateCollectionTargetValue(
        resolved.values[target.outerCollectionId],
        outerCollection,
        target.pathChain,
        sourceValue,
        mode
      );
      if (!updated) {
        continue;
      }
      resolved.values[target.outerCollectionId] = updated;
      if (!alreadyMigrated.has(target.outerCollectionId)) {
        alreadyMigrated.add(target.outerCollectionId);
        resolved.diffs.push(migratedDiff(target.outerCollectionId, undefined, updated));
      }
      if (mode === 'semantic') {
        delete resolved.values[source.nodeId];
        delete resolved.values[source.node.id];
      }
    }
  }
}

function applyCollectionToTop(
  mode: CrossLevelMode,
  priorLocations: NodeLocation[],
  newLocations: NodeLocation[],
  priorData: DataSnapshot,
  ctx: ReconciliationContext,
  resolved: NodeResolutionAccumulator
): void {
  const priorCollection = priorLocations.filter((loc) => loc.mode === mode && loc.level === 'collection');
  const newCollection = newLocations.filter((loc) => loc.mode === mode && loc.level === 'collection');
  const newTop = newLocations.filter((loc) => loc.mode === mode && loc.level === 'top');
  const alreadyMigrated = new Set<string>();
  if (mode === 'key') {
    for (const topTarget of newTop) {
      if (resolved.values[topTarget.nodeId] !== undefined) {
        continue;
      }
      if (!('defaultValue' in topTarget.node) || topTarget.node.defaultValue === undefined) {
        continue;
      }
      resolved.values[topTarget.nodeId] = { value: topTarget.node.defaultValue };
    }
  }

  for (const source of priorCollection) {
    if (!source.outerCollectionId || !source.pathChain || source.pathChain.length === 0) {
      continue;
    }
    if (!isRemovedFromLevel(source, newCollection)) {
      continue;
    }
    const priorCollectionNode = ctx.priorById.get(source.outerCollectionId);
    if (!priorCollectionNode || priorCollectionNode.type !== 'collection') {
      continue;
    }
    const extracted = readCollectionFirstItemValue(priorData, source.outerCollectionId, priorCollectionNode, source.pathChain);
    if (!extracted) {
      continue;
    }
    const targets = newTop
      .filter((loc) => loc.token === source.token)
      .sort((a, b) => a.nodeId.localeCompare(b.nodeId));
    for (const target of targets) {
      if (target.node.type !== source.node.type) {
        continue;
      }
      if (mode === 'semantic') {
        resolved.values[target.nodeId] = cloneNodeValue(extracted);
      } else {
        resolved.values[target.nodeId] = mergeAsSuggestion(
          resolved.values[target.nodeId] as NodeValue | undefined,
          extracted
        );
      }
      if (!alreadyMigrated.has(target.nodeId)) {
        alreadyMigrated.add(target.nodeId);
        resolved.diffs.push(migratedDiff(target.nodeId, undefined, resolved.values[target.nodeId]));
      }
    }
  }
}

function isRemovedFromLevel(source: NodeLocation, nextSameLevel: NodeLocation[]): boolean {
  return !nextSameLevel.some(
    (candidate) => candidate.token === source.token && candidate.node.type === source.node.type
  );
}

function readTopLevelValue(priorData: DataSnapshot, nodeId: string, rawId: string): NodeValue | undefined {
  const byScoped = priorData.values[nodeId];
  if (byScoped !== undefined) {
    return byScoped as NodeValue;
  }
  const byRaw = priorData.values[rawId];
  if (byRaw !== undefined) {
    return byRaw as NodeValue;
  }
  return undefined;
}

function updateCollectionTargetValue(
  currentValue: NodeValue | undefined,
  collectionNode: CollectionNode,
  pathChain: string[],
  sourceValue: NodeValue,
  mode: CrossLevelMode
): NodeValue<CollectionNodeState> | null {
  const normalized = normalizeCollectionState(currentValue, collectionNode);
  const items = normalized.value.items.map((item) => ({
    values: writePathChain(item.values ?? {}, collectionNode.template, pathChain, sourceValue, mode),
  }));
  const nextValue: NodeValue<CollectionNodeState> = {
    ...normalized,
    value: { items },
  };
  return nextValue;
}

function writePathChain(
  values: Record<string, NodeValue>,
  template: ViewNode,
  pathChain: string[],
  sourceValue: NodeValue,
  mode: CrossLevelMode
): Record<string, NodeValue> {
  if (pathChain.length === 0) {
    return values;
  }
  if (pathChain.length === 1) {
    const key = pathChain[0];
    const existing = values[key];
    const targetNode = findNodeByPath(template, key);
    const nextValue = mode === 'semantic'
      ? cloneNodeValue(sourceValue)
      : mergeAsSuggestion(existing, sourceValue, targetNode);
    return {
      ...values,
      [key]: nextValue,
    };
  }

  const nestedPath = pathChain[0];
  const nestedNode = findNodeByPath(template, nestedPath);
  if (!nestedNode || nestedNode.type !== 'collection') {
    return values;
  }
  const existingNested = values[nestedPath];
  const normalizedNested = normalizeCollectionState(existingNested, nestedNode);
  const nestedItems = normalizedNested.value.items.map((item) => ({
    values: writePathChain(item.values ?? {}, nestedNode.template, pathChain.slice(1), sourceValue, mode),
  }));
  const nextNested: NodeValue<CollectionNodeState> = {
    ...normalizedNested,
    value: { items: nestedItems },
  };
  return {
    ...values,
    [nestedPath]: nextNested,
  };
}

function clearCollectionTargetValue(
  currentValue: NodeValue | undefined,
  collectionNode: CollectionNode,
  pathChain: string[]
): NodeValue<CollectionNodeState> {
  const normalized = normalizeCollectionState(currentValue, collectionNode);
  const items = normalized.value.items.map((item) => ({
    values: clearPathChain(item.values ?? {}, collectionNode.template, pathChain),
  }));
  return {
    ...normalized,
    value: { items },
  };
}

function clearPathChain(
  values: Record<string, NodeValue>,
  template: ViewNode,
  pathChain: string[]
): Record<string, NodeValue> {
  if (pathChain.length === 0) {
    return values;
  }
  if (pathChain.length === 1) {
    const nextValues = { ...values };
    delete nextValues[pathChain[0]];
    return nextValues;
  }
  const nestedPath = pathChain[0];
  const nestedNode = findNodeByPath(template, nestedPath);
  if (!nestedNode || nestedNode.type !== 'collection') {
    return values;
  }
  const existingNested = values[nestedPath];
  if (existingNested === undefined) {
    return values;
  }
  const normalizedNested = normalizeCollectionState(existingNested, nestedNode);
  const nestedItems = normalizedNested.value.items.map((item) => ({
    values: clearPathChain(item.values ?? {}, nestedNode.template, pathChain.slice(1)),
  }));
  return {
    ...values,
    [nestedPath]: {
      ...normalizedNested,
      value: { items: nestedItems },
    },
  };
}

function readCollectionFirstItemValue(
  priorData: DataSnapshot,
  outerCollectionId: string,
  outerCollectionNode: CollectionNode,
  pathChain: string[]
): NodeValue | undefined {
  const root = priorData.values[outerCollectionId] as NodeValue | undefined;
  if (!root || typeof root !== 'object' || !('value' in root)) {
    return undefined;
  }
  const state = (root.value as CollectionNodeState | undefined)?.items;
  if (!Array.isArray(state) || state.length === 0) {
    return undefined;
  }
  return readPathFromItem(state[0].values ?? {}, outerCollectionNode.template, pathChain);
}

function readPathFromItem(
  values: Record<string, NodeValue>,
  template: ViewNode,
  pathChain: string[]
): NodeValue | undefined {
  if (pathChain.length === 0) {
    return undefined;
  }
  if (pathChain.length === 1) {
    return values[pathChain[0]];
  }
  const nestedPath = pathChain[0];
  const nestedNode = findNodeByPath(template, nestedPath);
  if (!nestedNode || nestedNode.type !== 'collection') {
    return undefined;
  }
  const nestedValue = values[nestedPath] as NodeValue<CollectionNodeState> | undefined;
  const nestedItems = nestedValue?.value?.items;
  if (!Array.isArray(nestedItems) || nestedItems.length === 0) {
    return undefined;
  }
  return readPathFromItem(nestedItems[0].values ?? {}, nestedNode.template, pathChain.slice(1));
}

function normalizeCollectionState(
  value: NodeValue | undefined,
  collectionNode: CollectionNode
): NodeValue<CollectionNodeState> {
  if (!value || typeof value !== 'object' || !('value' in value)) {
    return createInitialCollectionValue(collectionNode);
  }
  const items = ((value as NodeValue<CollectionNodeState>).value?.items ?? [])
    .map((item) => ({ values: { ...(item?.values ?? {}) } }));
  return {
    ...(value as NodeValue<CollectionNodeState>),
    value: { items },
  };
}

function findNodeByPath(template: ViewNode, relativePath: string): ViewNode | null {
  const segments = relativePath.split('/').filter((segment) => segment.length > 0);
  if (segments.length === 0 || segments[0] !== template.id) {
    return null;
  }
  let current: ViewNode = template;
  for (const segment of segments.slice(1)) {
    const child = getChildNodes(current).find((node) => node.id === segment);
    if (!child) {
      return null;
    }
    current = child;
  }
  return current;
}

function mergeAsSuggestion(
  existing: NodeValue | undefined,
  sourceValue: NodeValue,
  targetNode?: ViewNode | null
): NodeValue {
  if (
    existing &&
    sourceValue.isDirty === true &&
    existing.isDirty !== true &&
    existing.suggestion === undefined &&
    targetNode &&
    'defaultValue' in targetNode &&
    Object.is(existing.value, targetNode.defaultValue)
  ) {
    return cloneNodeValue(sourceValue);
  }
  const base: NodeValue = existing ? { ...existing } : { value: undefined };
  base.suggestion = sourceValue.value;
  if (sourceValue.value !== undefined && sourceValue.isDirty !== undefined) {
    base.isDirty = sourceValue.isDirty;
  }
  return base;
}

function cloneNodeValue(value: NodeValue): NodeValue {
  return structuredClone(value);
}
