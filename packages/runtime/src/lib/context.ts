import { type DataSnapshot, type ViewDefinition, type ViewNode, ISSUE_SEVERITY, ISSUE_CODES } from '@continuum/contract';
import type { ReconciliationIssue } from './types.js';
import { type TraversedViewNode, traverseViewNodes } from './reconciliation/view-traversal.js';

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
  newView: ViewDefinition;
  priorView: ViewDefinition | null;
  newById: Map<string, ViewNode>;
  newByKey: Map<string, ViewNode>;
  priorById: Map<string, ViewNode>;
  priorByKey: Map<string, ViewNode>;
  newIdsByRawId: Map<string, string[]>;
  priorIdsByRawId: Map<string, string[]>;
  newNodeIds: WeakMap<ViewNode, string>;
  priorNodeIds: WeakMap<ViewNode, string>;
  newKeyCounts: Map<string, number>;
  priorKeyCounts: Map<string, number>;
  issues: ReconciliationIssue[];
}

export function buildReconciliationContext(
  newView: ViewDefinition,
  priorView: ViewDefinition | null
): ReconciliationContext {
  const newById = new Map<string, ViewNode>();
  const newByKey = new Map<string, ViewNode>();
  const priorById = new Map<string, ViewNode>();
  const priorByKey = new Map<string, ViewNode>();
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
    priorById,
    priorByKey,
    newIdsByRawId,
    priorIdsByRawId,
    newNodeIds,
    priorNodeIds,
    newKeyCounts,
    priorKeyCounts,
    issues,
  };
}

export function findPriorNode(
  ctx: ReconciliationContext,
  newNode: ViewNode
): ViewNode | null {
  const newNodeId = ctx.newNodeIds.get(newNode) ?? newNode.id;
  const byId = ctx.priorById.get(newNodeId) ?? ctx.priorById.get(newNode.id);
  if (byId) return byId;

  if (newNode.key) {
    const byKey = findByKey(ctx.priorByKey, newNode.key, newNodeId);
    if (byKey) return byKey;
  }

  return null;
}

export function buildPriorValueLookupByIdAndKey(
  priorData: DataSnapshot,
  ctx: ReconciliationContext
): Map<string, unknown> {
  const map = new Map<string, unknown>();
  for (const [priorId, priorValue] of Object.entries(priorData.values)) {
    map.set(priorId, priorValue);
    const resolvedPriorId = resolveIdFromSnapshot(ctx.priorById, priorId);
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

export function determineNodeMatchStrategy(
  ctx: ReconciliationContext,
  newNode: ViewNode,
  priorNode: ViewNode | null
): 'id' | 'key' | null {
  if (!priorNode) return null;
  const newNodeId = ctx.newNodeIds.get(newNode) ?? newNode.id;
  return ctx.priorById.has(newNodeId) || ctx.priorById.has(newNode.id) ? 'id' : 'key';
}

export function resolvePriorSnapshotId(
  ctx: ReconciliationContext,
  priorId: string
): string | null {
  return resolveIdFromSnapshot(ctx.priorById, priorId);
}

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
  id: string
): string | null {
  if (byId.has(id)) {
    return id;
  }
  return null;
}

function findByKey(
  byKey: Map<string, ViewNode>,
  rawKey: string,
  scopedNodeId: string
): ViewNode | undefined {
  const direct = byKey.get(rawKey);
  if (direct) {
    return direct;
  }
  const parentPath = parentOf(scopedNodeId);
  if (parentPath) {
    return byKey.get(`${parentPath}/${rawKey}`);
  }
  return undefined;
}

function parentOf(path: string): string {
  const idx = path.lastIndexOf('/');
  if (idx === -1) {
    return '';
  }
  return path.slice(0, idx);
}
