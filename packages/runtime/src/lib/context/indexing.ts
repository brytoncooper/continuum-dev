import {
  ISSUE_CODES,
  ISSUE_SEVERITY,
  type ViewDefinition,
  type ViewNode,
} from '@continuum-dev/contract';
import type { ReconciliationIssue } from '../types.js';
import {
  type TraversedViewNode,
  traverseViewNodes,
} from '../reconciliation/view-traversal.js';
import { isUnique, toIndexedKey } from './helpers.js';
import type { ReconciliationContext, ScopedNodeMatch } from './types.js';

export function collectDuplicateIssues(
  nodes: ViewNode[]
): ReconciliationIssue[] {
  const issues: ReconciliationIssue[] = [];
  const traversal = traverseViewNodes(nodes);
  const byId = new Map<string, ViewNode>();
  const byKey = new Map<string, ViewNode>();
  const semanticKeyCounts = collectSemanticKeyCounts(traversal.visited);

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

    if (
      entry.node.semanticKey &&
      !isUnique(semanticKeyCounts, entry.node.semanticKey)
    ) {
      issues.push({
        severity: ISSUE_SEVERITY.WARNING,
        nodeId: entry.node.id,
        message: `Ambiguous semantic key: ${entry.node.semanticKey}`,
        code: ISSUE_CODES.SCOPE_COLLISION,
      });
    }
  }

  issues.push(...traversal.issues);
  return issues;
}

export function buildReconciliationContext(
  newView: ViewDefinition,
  priorView: ViewDefinition | null
): ReconciliationContext {
  const newTraversal = traverseViewNodes(newView.nodes);
  const priorTraversal = priorView ? traverseViewNodes(priorView.nodes) : null;

  const context: ReconciliationContext = {
    newView,
    priorView,
    newById: new Map<string, ViewNode>(),
    newByKey: new Map<string, ViewNode>(),
    newBySemanticKey: new Map<string, ScopedNodeMatch>(),
    priorById: new Map<string, ViewNode>(),
    priorByKey: new Map<string, ViewNode>(),
    priorBySemanticKey: new Map<string, ScopedNodeMatch>(),
    newNodeIds: new WeakMap<ViewNode, string>(),
    priorNodeIds: new WeakMap<ViewNode, string>(),
    newSemanticKeyCounts: collectSemanticKeyCounts(newTraversal.visited),
    priorSemanticKeyCounts: priorTraversal
      ? collectSemanticKeyCounts(priorTraversal.visited)
      : new Map<string, number>(),
    issues: [...newTraversal.issues, ...(priorTraversal?.issues ?? [])],
  };

  indexNodes(
    newTraversal.visited,
    context.newById,
    context.newByKey,
    context.newBySemanticKey,
    context.newNodeIds,
    context.newSemanticKeyCounts,
    context.issues
  );

  if (priorTraversal) {
    indexNodes(
      priorTraversal.visited,
      context.priorById,
      context.priorByKey,
      context.priorBySemanticKey,
      context.priorNodeIds,
      context.priorSemanticKeyCounts,
      context.issues
    );
  }

  return context;
}

function collectSemanticKeyCounts(
  traversed: TraversedViewNode[]
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const entry of traversed) {
    const semanticKey = entry.node.semanticKey;
    if (semanticKey) {
      counts.set(semanticKey, (counts.get(semanticKey) ?? 0) + 1);
    }
  }
  return counts;
}

function indexNodes(
  traversed: TraversedViewNode[],
  byId: Map<string, ViewNode>,
  byKey: Map<string, ViewNode>,
  bySemanticKey: Map<string, ScopedNodeMatch>,
  nodeIds: WeakMap<ViewNode, string>,
  semanticKeyCounts: Map<string, number>,
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

    const semanticKey = entry.node.semanticKey;
    if (!semanticKey) {
      continue;
    }
    if (!isUnique(semanticKeyCounts, semanticKey)) {
      issues.push({
        severity: ISSUE_SEVERITY.WARNING,
        nodeId: entry.node.id,
        message: `Ambiguous semantic key: ${semanticKey}`,
        code: ISSUE_CODES.SCOPE_COLLISION,
      });
      continue;
    }
    bySemanticKey.set(semanticKey, {
      node: entry.node,
      nodeId: indexedId,
    });
  }
}
