import {
  type ViewDefinition,
  type ViewNode,
} from '@continuum-dev/contract';
import { ISSUE_CODES, ISSUE_SEVERITY } from '@continuum-dev/protocol';
import type { ReconciliationIssue } from '../types.js';
import {
  type TraversedViewNode,
  traverseViewNodes,
} from '../reconciliation/view-traversal/index.js';
import { isUnique, toIndexedKey } from './helpers.js';
import type { ReconciliationContext, ScopedNodeMatch } from './types.js';

export function collectDuplicateIssues(
  nodes: ViewNode[]
): ReconciliationIssue[] {
  const traversal = traverseViewNodes({ nodes });
  const semanticKeyCounts = collectSemanticKeyCounts(traversal.visited);
  const issues: ReconciliationIssue[] = [];

  indexNodes(traversal.visited, {
    byId: new Map<string, ViewNode>(),
    byKey: new Map<string, ViewNode>(),
    bySemanticKey: null,
    nodeIds: null,
    semanticKeyCounts,
    issues,
  });

  issues.push(...traversal.issues);
  return issues;
}

export function buildReconciliationContext(
  newView: ViewDefinition,
  priorView: ViewDefinition | null
): ReconciliationContext {
  const newTraversal = traverseViewNodes({ nodes: newView.nodes });
  const priorTraversal = priorView
    ? traverseViewNodes({ nodes: priorView.nodes })
    : null;

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

  indexNodes(newTraversal.visited, {
    byId: context.newById,
    byKey: context.newByKey,
    bySemanticKey: context.newBySemanticKey,
    nodeIds: context.newNodeIds,
    semanticKeyCounts: context.newSemanticKeyCounts,
    issues: context.issues,
  });

  if (priorTraversal) {
    indexNodes(priorTraversal.visited, {
      byId: context.priorById,
      byKey: context.priorByKey,
      bySemanticKey: context.priorBySemanticKey,
      nodeIds: context.priorNodeIds,
      semanticKeyCounts: context.priorSemanticKeyCounts,
      issues: context.issues,
    });
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

interface IndexState {
  byId: Map<string, ViewNode>;
  byKey: Map<string, ViewNode>;
  bySemanticKey: Map<string, ScopedNodeMatch> | null;
  nodeIds: WeakMap<ViewNode, string> | null;
  semanticKeyCounts: Map<string, number>;
  issues: ReconciliationIssue[];
}

function indexNodes(traversed: TraversedViewNode[], state: IndexState): void {
  for (const entry of traversed) {
    indexNode(entry, state);
  }
}

function indexNode(entry: TraversedViewNode, state: IndexState): void {
  const { byId, byKey, bySemanticKey, nodeIds, semanticKeyCounts, issues } =
    state;
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
  nodeIds?.set(entry.node, indexedId);

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
    return;
  }
  if (!isUnique(semanticKeyCounts, semanticKey)) {
    issues.push({
      severity: ISSUE_SEVERITY.WARNING,
      nodeId: entry.node.id,
      message: `Ambiguous semantic key: ${semanticKey}`,
      code: ISSUE_CODES.SCOPE_COLLISION,
    });
    return;
  }
  bySemanticKey?.set(semanticKey, {
    node: entry.node,
    nodeId: indexedId,
  });
}
