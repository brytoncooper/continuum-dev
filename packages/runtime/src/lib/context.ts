import { getChildNodes, type DataSnapshot, type ViewDefinition, type ViewNode } from '@continuum/contract';

export interface ReconciliationContext {
  newView: ViewDefinition;
  priorView: ViewDefinition | null;
  newById: Map<string, ViewNode>;
  newByKey: Map<string, ViewNode>;
  priorById: Map<string, ViewNode>;
  priorByKey: Map<string, ViewNode>;
}

export function buildReconciliationContext(
  newView: ViewDefinition,
  priorView: ViewDefinition | null
): ReconciliationContext {
  const newById = new Map<string, ViewNode>();
  const newByKey = new Map<string, ViewNode>();
  const priorById = new Map<string, ViewNode>();
  const priorByKey = new Map<string, ViewNode>();

  function indexNodesByIdAndKey(
    nodes: ViewNode[],
    byId: Map<string, ViewNode>,
    byKey: Map<string, ViewNode>
  ) {
    for (const node of nodes) {
      byId.set(node.id, node);
      if (node.key) {
        byKey.set(node.key, node);
      }
      const children = getChildNodes(node);
      if (children.length > 0) {
        indexNodesByIdAndKey(children, byId, byKey);
      }
    }
  }

  indexNodesByIdAndKey(newView.nodes, newById, newByKey);
  if (priorView) {
    indexNodesByIdAndKey(priorView.nodes, priorById, priorByKey);
  }

  return {
    newView,
    priorView,
    newById,
    newByKey,
    priorById,
    priorByKey,
  };
}

export function findPriorNode(
  ctx: ReconciliationContext,
  newNode: ViewNode
): ViewNode | null {
  const byId = ctx.priorById.get(newNode.id);
  if (byId) return byId;

  if (newNode.key) {
    const byKey = ctx.priorByKey.get(newNode.key);
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
    const priorNode = ctx.priorById.get(priorId);
    if (priorNode?.key) {
      const newNode = ctx.newByKey.get(priorNode.key);
      if (newNode) map.set(newNode.id, priorValue);
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
  return ctx.priorById.has(newNode.id) ? 'id' : 'key';
}
