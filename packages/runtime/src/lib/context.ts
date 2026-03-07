import { type DataSnapshot, type ViewDefinition, type ViewNode, ISSUE_SEVERITY, ISSUE_CODES } from '@continuum/contract';
import type { ReconciliationIssue } from './types.js';
import { type TraversedViewNode, traverseViewNodes } from './reconciliation/view-traversal.js';

/**
 * Scans a view tree for duplicate ids/keys and traversal-level issues.
 *
 * Useful for preflight checks when validating generated views before running
 * full reconciliation.
 *
 * @param nodes Root nodes from a view definition.
 * @returns Aggregated issues for duplicates and traversal anomalies.
 */
export function collectDuplicateIssues(nodes: ViewNode[]): ReconciliationIssue[] {
  const issues: ReconciliationIssue[] = [];
  const byId = new Map<string, ViewNode>();
  const byKey = new Map<string, ViewNode>();
  const traversal = traverseViewNodes(nodes);
  for (const entry of traversal.visited) {
    const indexedId = entry.nodeId;
    if (byId.has(indexedId)) {
      issues.push({
        severity: ISSUE_SEVERITY.ERROR,
        nodeId: entry.node.id,
        message: `Duplicate node id: ${entry.node.id}`,
        code: ISSUE_CODES.DUPLICATE_NODE_ID,
      });
    }
    byId.set(indexedId, entry.node);
    if (entry.node.key) {
      const indexedKey = toIndexedKey(entry.node.key, entry.parentPath);
      if (byKey.has(indexedKey)) {
        issues.push({
          severity: ISSUE_SEVERITY.WARNING,
          nodeId: entry.node.id,
          message: `Duplicate node key: ${entry.node.key}`,
          code: ISSUE_CODES.DUPLICATE_NODE_KEY,
        });
      }
      byKey.set(indexedKey, entry.node);
    }
  }
  issues.push(...traversal.issues);
  return issues;
}

export interface ReconciliationContext {
  /**
   * New view currently being reconciled.
   */
  newView: ViewDefinition;
  /**
   * Prior view used for matching, if available.
   */
  priorView: ViewDefinition | null;
  /**
   * New-view node lookup keyed by scoped node id.
   */
  newById: Map<string, ViewNode>;
  /**
   * New-view node lookup keyed by semantic key (scoped when needed).
   */
  newByKey: Map<string, ViewNode>;
  newBySemanticKey: Map<string, { node: ViewNode; nodeId: string }>;
  /**
   * Prior-view node lookup keyed by scoped node id.
   */
  priorById: Map<string, ViewNode>;
  /**
   * Prior-view node lookup keyed by semantic key (scoped when needed).
   */
  priorByKey: Map<string, ViewNode>;
  priorBySemanticKey: Map<string, { node: ViewNode; nodeId: string }>;
  /**
   * New-view indexed ids grouped by raw node id.
   */
  newIdsByRawId: Map<string, string[]>;
  /**
   * Prior-view indexed ids grouped by raw node id.
   */
  priorIdsByRawId: Map<string, string[]>;
  /**
   * Stable mapping from new node objects to scoped node ids.
   */
  newNodeIds: WeakMap<ViewNode, string>;
  /**
   * Stable mapping from prior node objects to scoped node ids.
   */
  priorNodeIds: WeakMap<ViewNode, string>;
  /**
   * Frequency table for keys in the new view.
   */
  newKeyCounts: Map<string, number>;
  /**
   * Frequency table for keys in the prior view.
   */
  priorKeyCounts: Map<string, number>;
  /**
   * Issues captured while indexing both view trees.
   */
  issues: ReconciliationIssue[];
}

/**
 * Builds lookup maps used by the reconciliation matching pipeline.
 *
 * Context indexes scoped ids and semantic keys so downstream logic can resolve
 * carry/migrate/restore decisions in O(1) lookups.
 *
 * @param newView Target view for this reconciliation cycle.
 * @param priorView Previous view to compare against, if available.
 * @returns Indexed reconciliation context consumed by resolver stages.
 */
export function buildReconciliationContext(
  newView: ViewDefinition,
  priorView: ViewDefinition | null
): ReconciliationContext {
  const newById = new Map<string, ViewNode>();
  const newByKey = new Map<string, ViewNode>();
  const newBySemanticKey = new Map<string, { node: ViewNode; nodeId: string }>();
  const priorById = new Map<string, ViewNode>();
  const priorByKey = new Map<string, ViewNode>();
  const priorBySemanticKey = new Map<string, { node: ViewNode; nodeId: string }>();
  const newIdsByRawId = new Map<string, string[]>();
  const priorIdsByRawId = new Map<string, string[]>();
  const newNodeIds = new WeakMap<ViewNode, string>();
  const priorNodeIds = new WeakMap<ViewNode, string>();
  const issues: ReconciliationIssue[] = [];
  const newTraversal = traverseViewNodes(newView.nodes);
  const priorTraversal = priorView ? traverseViewNodes(priorView.nodes) : null;
  const newKeyCounts = collectKeyCounts(newTraversal.visited);
  const priorKeyCounts = priorTraversal ? collectKeyCounts(priorTraversal.visited) : new Map<string, number>();
  issues.push(...newTraversal.issues);
  if (priorTraversal) {
    issues.push(...priorTraversal.issues);
  }

  indexNodesByIdAndKey(
    newTraversal.visited,
    newById,
    newByKey,
    newBySemanticKey,
    newIdsByRawId,
    newNodeIds,
    newKeyCounts,
    issues
  );
  if (priorView) {
    indexNodesByIdAndKey(
      priorTraversal?.visited ?? [],
      priorById,
      priorByKey,
      priorBySemanticKey,
      priorIdsByRawId,
      priorNodeIds,
      priorKeyCounts,
      issues
    );
  }

  return {
    newView,
    priorView,
    newById,
    newByKey,
    newBySemanticKey,
    priorById,
    priorByKey,
    priorBySemanticKey,
    newIdsByRawId,
    priorIdsByRawId,
    newNodeIds,
    priorNodeIds,
    newKeyCounts,
    priorKeyCounts,
    issues,
  };
}

/**
 * Resolves the best prior-view match for a node in the new view.
 *
 * Matching is attempted in deterministic order: scoped id, semantic key,
 * dot-suffix key fallback, and unique raw-id fallback.
 *
 * @param ctx Reconciliation context with prior/new indexes.
 * @param newNode Node from the new view to resolve against prior view.
 * @returns Matched prior node, or null when no candidate can be resolved.
 */
export function findPriorNode(
  ctx: ReconciliationContext,
  newNode: ViewNode
): ViewNode | null {
  // 1. Exact Full Path ID
  const newNodeId = ctx.newNodeIds.get(newNode) ?? newNode.id;
  const byId = ctx.priorById.get(newNodeId) ?? ctx.priorById.get(newNode.id);
  if (byId) return byId;

  // 2. Exact Key
  if (newNode.key) {
    const byKey = findByKey(ctx.priorByKey, newNode.key, newNodeId);
    if (byKey) return byKey;
    
    // 3. Dot-Notation Suffix Key
    if (newNode.key.includes('.')) {
      const parts = newNode.key.split('.');
      const suffix = parts[parts.length - 1];
      if (suffix) {
        const bySuffixKey = findByKey(ctx.priorByKey, suffix, newNodeId);
        if (bySuffixKey) return bySuffixKey;
      }
    }
  }

  // 4. Unique Raw ID Mapping
  const candidates = ctx.priorIdsByRawId.get(newNode.id);
  if (candidates && candidates.length === 1) {
    const uniquePriorId = candidates[0];
    const uniqueNode = ctx.priorById.get(uniquePriorId);
    if (uniqueNode) return uniqueNode;
  }

  // 5. Dot-Notation Suffix ID Match (Match newly dot-notated key to old unique raw ID)
  if (newNode.key && newNode.key.includes('.')) {
    const parts = newNode.key.split('.');
    const suffix = parts[parts.length - 1];
    if (suffix) {
      const keyCandidates = ctx.priorIdsByRawId.get(suffix);
      if (keyCandidates && keyCandidates.length === 1) {
        const uniqueNode = ctx.priorById.get(keyCandidates[0]);
        if (uniqueNode) return uniqueNode;
      }
    }
  }

  return null;
}

/**
 * Builds a value lookup that supports id-based and key-based carry.
 *
 * The returned map contains direct prior ids plus remapped ids when semantic
 * key matches indicate the value should move to a different node id.
 *
 * @param priorData Previous data snapshot.
 * @param ctx Reconciliation context built from prior/new views.
 * @returns Value lookup used by node resolution.
 */
export function buildPriorValueLookupByIdAndKey(
  priorData: DataSnapshot,
  ctx: ReconciliationContext
): Map<string, unknown> {
  const map = new Map<string, unknown>();
  for (const [priorId, priorValue] of Object.entries(priorData.values)) {
    map.set(priorId, priorValue);
    const resolvedPriorId = resolveIdFromSnapshot(ctx.priorById, ctx.priorIdsByRawId, priorId);
    if (resolvedPriorId && resolvedPriorId !== priorId) {
      map.set(resolvedPriorId, priorValue);
    }
    const priorNode = resolvedPriorId ? ctx.priorById.get(resolvedPriorId) : undefined;
    if (priorNode?.key) {
      const newNode = findByKey(
        ctx.newByKey,
        priorNode.key,
        resolvedPriorId ?? priorNode.id
      );
      if (newNode) {
        const newNodeId = ctx.newNodeIds.get(newNode) ?? newNode.id;
        map.set(newNodeId, priorValue);
      }
    }
  }
  return map;
}

/**
 * Reports whether a match was resolved by id or by semantic key.
 *
 * This metadata is attached to reconciliation resolution records so consumers
 * can explain why a value was carried/migrated/restored.
 *
 * @param ctx Reconciliation context with id/key indexes.
 * @param newNode Node from the new view.
 * @param priorNode Prior match candidate for the new node.
 * @returns `id`, `key`, or null when no prior node exists.
 */
export function determineNodeMatchStrategy(
  ctx: ReconciliationContext,
  newNode: ViewNode,
  priorNode: ViewNode | null
): 'id' | 'key' | null {
  if (!priorNode) return null;
  const newNodeId = ctx.newNodeIds.get(newNode) ?? newNode.id;
  if (ctx.priorById.has(newNodeId) || ctx.priorById.has(newNode.id)) return 'id';
  
  if (newNode.key && (ctx.priorByKey.has(newNode.key) || findByKey(ctx.priorByKey, newNode.key, newNodeId) === priorNode)) return 'key';

  if (newNode.key && newNode.key.includes('.')) {
    const parts = newNode.key.split('.');
    const suffix = parts[parts.length - 1];
    if (suffix && findByKey(ctx.priorByKey, suffix, newNodeId) === priorNode) return 'key';
  }

  if (priorNode.id === newNode.id) return 'id';

  if (newNode.key && newNode.key.includes('.')) {
    const parts = newNode.key.split('.');
    const suffix = parts[parts.length - 1];
    if (suffix && priorNode.id === suffix) return 'id';
  }

  return 'id'; // fallback to id for other fuzzy matches
}

/**
 * Resolves a snapshot value key to a unique scoped prior node id.
 *
 * @param ctx Reconciliation context with prior-view indexes.
 * @param priorId Snapshot key from `priorData.values`.
 * @returns Scoped prior id when uniquely resolvable; otherwise null.
 */
export function resolvePriorSnapshotId(
  ctx: ReconciliationContext,
  priorId: string
): string | null {
  return resolveIdFromSnapshot(ctx.priorById, ctx.priorIdsByRawId, priorId);
}

/**
 * Finds the best new-view node candidate for a given prior node by key.
 *
 * @param ctx Reconciliation context with new-view key indexes.
 * @param priorNode Prior-view node to map forward.
 * @returns Matching new-view node, or null when no key-compatible node exists.
 */
export function findNewNodeByPriorNode(
  ctx: ReconciliationContext,
  priorNode: ViewNode
): ViewNode | null {
  if (!priorNode.key) return null;
  const priorId = ctx.priorNodeIds.get(priorNode) ?? priorNode.id;
  return (
    findByKey(
      ctx.newByKey,
      priorNode.key,
      priorId
    ) ?? null
  );
}

function collectKeyCounts(traversed: TraversedViewNode[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const entry of traversed) {
    if (entry.node.key) {
      counts.set(entry.node.key, (counts.get(entry.node.key) ?? 0) + 1);
    }
  }
  return counts;
}

function indexNodesByIdAndKey(
  traversed: TraversedViewNode[],
  byId: Map<string, ViewNode>,
  byKey: Map<string, ViewNode>,
  bySemanticKey: Map<string, { node: ViewNode; nodeId: string }>,
  idsByRawId: Map<string, string[]>,
  nodeIds: WeakMap<ViewNode, string>,
  keyCounts: Map<string, number>,
  issues: ReconciliationIssue[]
): void {
  for (const entry of traversed) {
    const indexedId = entry.nodeId;
    if (byId.has(indexedId)) {
      issues.push({
        severity: ISSUE_SEVERITY.ERROR,
        nodeId: entry.node.id,
        message: `Duplicate node id: ${entry.node.id}`,
        code: ISSUE_CODES.DUPLICATE_NODE_ID,
      });
    }
    byId.set(indexedId, entry.node);
    nodeIds.set(entry.node, indexedId);
    idsByRawId.set(entry.node.id, [...(idsByRawId.get(entry.node.id) ?? []), indexedId]);

    if (entry.node.key) {
      const indexedKey = toIndexedKey(entry.node.key, entry.parentPath);
      if (byKey.has(indexedKey)) {
        issues.push({
          severity: ISSUE_SEVERITY.WARNING,
          nodeId: entry.node.id,
          message: `Duplicate node key: ${entry.node.key}`,
          code: ISSUE_CODES.DUPLICATE_NODE_KEY,
        });
      }
      byKey.set(indexedKey, entry.node);
      if (!byKey.has(entry.node.key) && (keyCounts.get(entry.node.key) ?? 0) === 1) {
        byKey.set(entry.node.key, entry.node);
      }
    }

    const semanticKey = entry.node.semanticKey;
    if (semanticKey !== undefined && semanticKey.length > 0) {
      bySemanticKey.set(semanticKey, { node: entry.node, nodeId: indexedId });
    }
  }
}

function toIndexedKey(key: string, parentPath: string): string {
  if (parentPath.length > 0) {
    return `${parentPath}/${key}`;
  }
  return key;
}

function resolveIdFromSnapshot(
  byId: Map<string, ViewNode>,
  idsByRawId: Map<string, string[]>,
  id: string
): string | null {
  if (byId.has(id)) {
    return id;
  }
  const candidates = idsByRawId.get(id) ?? [];
  if (candidates.length === 1) {
    return candidates[0];
  }
  return null;
}

function findByKey(
  byKey: Map<string, ViewNode>,
  rawKey: string,
  scopedNodeId: string
): ViewNode | undefined {
  const parentPath = parentOf(scopedNodeId);
  if (parentPath) {
    const scoped = byKey.get(`${parentPath}/${rawKey}`);
    if (scoped) return scoped;
  }
  return byKey.get(rawKey);
}

function parentOf(path: string): string {
  const idx = path.lastIndexOf('/');
  if (idx === -1) {
    return '';
  }
  return path.slice(0, idx);
}
