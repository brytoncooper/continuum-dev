import { getChildNodes, type DataSnapshot, type ViewDefinition, type ViewNode, ISSUE_SEVERITY, ISSUE_CODES } from '@continuum/contract';
import type { ReconciliationIssue } from './types.js';

export function collectDuplicateIssues(nodes: ViewNode[]): ReconciliationIssue[] {
  const issues: ReconciliationIssue[] = [];
  const byId = new Map<string, ViewNode>();
  const byKey = new Map<string, ViewNode>();

  function walk(nodes: ViewNode[], parentPath: string) {
    for (const node of nodes) {
      const indexedId = toIndexedId(node.id, parentPath);
      if (byId.has(indexedId)) {
        issues.push({
          severity: ISSUE_SEVERITY.ERROR,
          nodeId: node.id,
          message: `Duplicate node id: ${node.id}`,
          code: ISSUE_CODES.DUPLICATE_NODE_ID,
        });
      }
      byId.set(indexedId, node);
      if (node.key) {
        const indexedKey = toIndexedKey(node.key, parentPath);
        if (byKey.has(indexedKey)) {
          issues.push({
            severity: ISSUE_SEVERITY.WARNING,
            nodeId: node.id,
            message: `Duplicate node key: ${node.key}`,
            code: ISSUE_CODES.DUPLICATE_NODE_KEY,
          });
        }
        byKey.set(indexedKey, node);
      }
      const children = getChildNodes(node);
      if (children.length > 0) {
        walk(children, indexedId);
      }
    }
  }

  walk(nodes, '');
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
  const newKeyCounts = collectKeyCounts(newView.nodes);
  const priorKeyCounts = priorView ? collectKeyCounts(priorView.nodes) : new Map<string, number>();

  indexNodesByIdAndKey(
    newView.nodes,
    '',
    newById,
    newByKey,
    newIdsByRawId,
    newNodeIds,
    newKeyCounts,
    issues
  );
  if (priorView) {
    indexNodesByIdAndKey(
      priorView.nodes,
      '',
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

function collectKeyCounts(nodes: ViewNode[]): Map<string, number> {
  const counts = new Map<string, number>();
  const walk = (items: ViewNode[]): void => {
    for (const node of items) {
      if (node.key) {
        counts.set(node.key, (counts.get(node.key) ?? 0) + 1);
      }
      const children = getChildNodes(node);
      if (children.length > 0) {
        walk(children);
      }
    }
  };
  walk(nodes);
  return counts;
}

function indexNodesByIdAndKey(
  nodes: ViewNode[],
  parentPath: string,
  byId: Map<string, ViewNode>,
  byKey: Map<string, ViewNode>,
  idsByRawId: Map<string, string[]>,
  nodeIds: WeakMap<ViewNode, string>,
  keyCounts: Map<string, number>,
  issues: ReconciliationIssue[]
): void {
  for (const node of nodes) {
    const indexedId = toIndexedId(node.id, parentPath);
    if (byId.has(indexedId)) {
      issues.push({
        severity: ISSUE_SEVERITY.ERROR,
        nodeId: node.id,
        message: `Duplicate node id: ${node.id}`,
        code: ISSUE_CODES.DUPLICATE_NODE_ID,
      });
    }
    byId.set(indexedId, node);
    nodeIds.set(node, indexedId);
    idsByRawId.set(node.id, [...(idsByRawId.get(node.id) ?? []), indexedId]);

    if (node.key) {
      const indexedKey = toIndexedKey(node.key, parentPath);
      if (byKey.has(indexedKey)) {
        issues.push({
          severity: ISSUE_SEVERITY.WARNING,
          nodeId: node.id,
          message: `Duplicate node key: ${node.key}`,
          code: ISSUE_CODES.DUPLICATE_NODE_KEY,
        });
      }
      byKey.set(indexedKey, node);
      if (!byKey.has(node.key) && (keyCounts.get(node.key) ?? 0) === 1) {
        byKey.set(node.key, node);
      }
    }

    const children = getChildNodes(node);
    if (children.length > 0) {
      indexNodesByIdAndKey(
        children,
        indexedId,
        byId,
        byKey,
        idsByRawId,
        nodeIds,
        keyCounts,
        issues
      );
    }
  }
}

function toIndexedId(id: string, parentPath: string): string {
  if (parentPath.length > 0) {
    return `${parentPath}/${id}`;
  }
  return id;
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
