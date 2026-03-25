import type { DataSnapshot, ViewDefinition, ViewNode } from '@continuum-dev/contract';
import {
  ISSUE_CODES,
  ISSUE_SEVERITY,
  type ViewEvolutionDiagnostic,
  type ViewEvolutionDiagnostics,
  type ViewEvolutionMetrics,
} from '@continuum-dev/protocol';

const STATEFUL_NODE_TYPES = new Set<string>([
  'field',
  'textarea',
  'date',
  'select',
  'radio-group',
  'slider',
  'toggle',
  'collection',
]);

const DEFAULT_MAX_LAYOUT_DEPTH = 32;

function countDetachedEntries(data: DataSnapshot | undefined): number {
  if (!data?.detachedValues) {
    return 0;
  }
  return Object.keys(data.detachedValues).length;
}

function getChildren(node: ViewNode): ViewNode[] {
  if (
    (node.type === 'group' || node.type === 'row' || node.type === 'grid') &&
    Array.isArray(node.children)
  ) {
    return node.children;
  }
  if (node.type === 'collection' && node.template) {
    return [node.template];
  }
  return [];
}

function maxDepth(nodes: ViewNode[], depth = 1): number {
  let max = depth;
  for (const node of nodes) {
    const children = getChildren(node);
    if (children.length > 0) {
      max = Math.max(max, maxDepth(children, depth + 1));
    }
  }
  return max;
}

interface IndexedStatefulNode {
  id: string;
  type: string;
  semanticKey?: string;
}

function indexStatefulNodes(
  nodes: ViewNode[],
  byId: Map<string, IndexedStatefulNode>
): void {
  for (const node of nodes) {
    if (typeof node.id !== 'string') {
      continue;
    }
    if (STATEFUL_NODE_TYPES.has(node.type)) {
      byId.set(node.id, {
        id: node.id,
        type: node.type,
        semanticKey:
          typeof node.semanticKey === 'string' ? node.semanticKey : undefined,
      });
    }
    getChildren(node).forEach((child) => indexStatefulNodes([child], byId));
  }
}

function indexActionNodes(
  nodes: ViewNode[],
  byId: Map<string, { id: string; intentId: string }>
): void {
  for (const node of nodes) {
    if (node.type === 'action' && typeof node.id === 'string') {
      byId.set(node.id, {
        id: node.id,
        intentId:
          typeof node.intentId === 'string' ? node.intentId : '',
      });
    }
    getChildren(node).forEach((child) => indexActionNodes([child], byId));
  }
}

function collectSemanticKeys(nodes: ViewNode[], keys: Set<string>): void {
  for (const node of nodes) {
    if (
      STATEFUL_NODE_TYPES.has(node.type) &&
      typeof node.semanticKey === 'string' &&
      node.semanticKey.trim().length > 0
    ) {
      keys.add(node.semanticKey.trim());
    }
    getChildren(node).forEach((child) => collectSemanticKeys([child], keys));
  }
}

function validateStatefulSemanticKeys(
  nodes: ViewNode[],
  issues: ViewEvolutionDiagnostic[]
): void {
  for (const node of nodes) {
    if (STATEFUL_NODE_TYPES.has(node.type)) {
      const semanticKey =
        typeof node.semanticKey === 'string' ? node.semanticKey.trim() : '';
      if (!semanticKey) {
        issues.push({
          code: ISSUE_CODES.SEMANTIC_KEY_MISSING_STATEFUL,
          severity: ISSUE_SEVERITY.ERROR,
          message: `Stateful node "${node.id}" is missing semanticKey.`,
          nodeId: node.id,
        });
      }
    }
    if (node.type === 'collection') {
      if (!node.template || typeof node.template !== 'object') {
        issues.push({
          code: ISSUE_CODES.COLLECTION_TEMPLATE_INVALID,
          severity: ISSUE_SEVERITY.ERROR,
          message: `Collection "${node.id}" is missing a valid template.`,
          nodeId: node.id,
        });
      } else {
        const templateFields = collectTemplateFieldCount(node.template);
        if (templateFields === 0) {
          issues.push({
            code: ISSUE_CODES.COLLECTION_TEMPLATE_INVALID,
            severity: ISSUE_SEVERITY.ERROR,
            message: `Collection "${node.id}" template has no field descendants.`,
            nodeId: node.id,
          });
        }
      }
    }
    getChildren(node).forEach((child) =>
      validateStatefulSemanticKeys([child], issues)
    );
  }
}

function collectTemplateFieldCount(node: ViewNode): number {
  let count = 0;
  if (node.type === 'field') {
    return 1;
  }
  for (const child of getChildren(node)) {
    count += collectTemplateFieldCount(child);
  }
  return count;
}

function collectDuplicateSemanticKeys(
  nodes: ViewNode[],
  seen: Map<string, string>,
  issues: ViewEvolutionDiagnostic[]
): void {
  for (const node of nodes) {
    if (
      STATEFUL_NODE_TYPES.has(node.type) &&
      typeof node.semanticKey === 'string' &&
      node.semanticKey.trim().length > 0
    ) {
      const sk = node.semanticKey.trim();
      const existing = seen.get(sk);
      if (existing && existing !== node.id) {
        issues.push({
          code: ISSUE_CODES.DUPLICATE_NODE_KEY,
          severity: ISSUE_SEVERITY.ERROR,
          message: `Duplicate semanticKey "${sk}" on nodes "${existing}" and "${node.id}".`,
          nodeId: node.id,
          semanticKey: sk,
        });
      } else if (!existing) {
        seen.set(sk, node.id);
      }
    }
    getChildren(node).forEach((child) =>
      collectDuplicateSemanticKeys([child], seen, issues)
    );
  }
}

export interface BuildViewEvolutionDiagnosticsInput {
  priorView: ViewDefinition;
  nextView: ViewDefinition;
  priorData?: DataSnapshot;
  nextData?: DataSnapshot;
  registeredIntentIds?: ReadonlySet<string>;
}

/**
 * Computes objective continuity and churn metrics between two view revisions,
 * plus validation issues for AI-authored stateful identity rules.
 */
export function buildViewEvolutionDiagnostics(
  input: BuildViewEvolutionDiagnosticsInput
): ViewEvolutionDiagnostics {
  const issues: ViewEvolutionDiagnostic[] = [];
  const priorById = new Map<string, IndexedStatefulNode>();
  const nextById = new Map<string, IndexedStatefulNode>();
  indexStatefulNodes(input.priorView.nodes, priorById);
  indexStatefulNodes(input.nextView.nodes, nextById);

  validateStatefulSemanticKeys(input.nextView.nodes, issues);
  collectDuplicateSemanticKeys(input.nextView.nodes, new Map(), issues);

  const priorKeys = new Set<string>();
  const nextKeys = new Set<string>();
  collectSemanticKeys(input.priorView.nodes, priorKeys);
  collectSemanticKeys(input.nextView.nodes, nextKeys);

  let continuityLossCount = 0;
  for (const key of priorKeys) {
    if (!nextKeys.has(key)) {
      continuityLossCount += 1;
    }
  }
  if (continuityLossCount > 0) {
    issues.push({
      code: ISSUE_CODES.CONTINUITY_LOSS,
      severity: ISSUE_SEVERITY.WARNING,
      message: `${continuityLossCount} semantic key(s) from the prior view are missing in the next view.`,
      metric: continuityLossCount,
    });
  }

  let semanticKeyChurnCount = 0;
  for (const [id, prior] of priorById) {
    const next = nextById.get(id);
    if (!next) {
      continue;
    }
    const p = prior.semanticKey?.trim() ?? '';
    const n = next.semanticKey?.trim() ?? '';
    if (p && n && p !== n) {
      semanticKeyChurnCount += 1;
      issues.push({
        code: ISSUE_CODES.SEMANTIC_KEY_CHURN,
        severity: ISSUE_SEVERITY.WARNING,
        message: `Node "${id}" changed semanticKey from "${p}" to "${n}".`,
        nodeId: id,
        metric: 1,
      });
    }
  }

  let nodesReplaced = 0;
  let nodesPatchedInPlace = 0;
  for (const [id, prior] of priorById) {
    const next = nextById.get(id);
    if (!next) {
      nodesReplaced += 1;
      continue;
    }
    if (prior.type === next.type) {
      nodesPatchedInPlace += 1;
    } else {
      nodesReplaced += 1;
    }
  }

  const priorCount = Math.max(1, priorById.size);
  const replacementRatio = nodesReplaced / priorCount;

  const maxLayoutDepthPrior = maxDepth(input.priorView.nodes);
  const maxLayoutDepthNext = maxDepth(input.nextView.nodes);
  const layoutDepthDelta = maxLayoutDepthNext - maxLayoutDepthPrior;

  if (maxLayoutDepthNext > DEFAULT_MAX_LAYOUT_DEPTH) {
    issues.push({
      code: ISSUE_CODES.VIEW_MAX_DEPTH_EXCEEDED,
      severity: ISSUE_SEVERITY.ERROR,
      message: `Next view exceeds max layout depth (${maxLayoutDepthNext} > ${DEFAULT_MAX_LAYOUT_DEPTH}).`,
      metric: maxLayoutDepthNext,
    });
  } else if (layoutDepthDelta > 4) {
    issues.push({
      code: ISSUE_CODES.LAYOUT_DEPTH_EXPLOSION,
      severity: ISSUE_SEVERITY.WARNING,
      message: `Layout depth grew by ${layoutDepthDelta} levels.`,
      metric: layoutDepthDelta,
    });
  }

  const detachedPrior = countDetachedEntries(input.priorData);
  const detachedNext = countDetachedEntries(input.nextData);
  const detachedFieldDelta = detachedNext - detachedPrior;
  if (detachedFieldDelta > 0) {
    issues.push({
      code: ISSUE_CODES.DETACHED_FIELD_GROWTH,
      severity: ISSUE_SEVERITY.WARNING,
      message: `Detached values grew by ${detachedFieldDelta}.`,
      metric: detachedFieldDelta,
    });
  }

  if (replacementRatio > 0.5 && priorById.size > 0) {
    issues.push({
      code: ISSUE_CODES.VIEW_REPLACEMENT_RATIO_HIGH,
      severity: ISSUE_SEVERITY.WARNING,
      message: `High replacement ratio (${replacementRatio.toFixed(2)}) for stateful nodes.`,
      metric: replacementRatio,
    });
  }

  const actionsById = new Map<string, { id: string; intentId: string }>();
  indexActionNodes(input.nextView.nodes, actionsById);
  let orphanedActionCount = 0;
  if (input.registeredIntentIds && input.registeredIntentIds.size > 0) {
    for (const [, action] of actionsById) {
      if (!input.registeredIntentIds.has(action.intentId)) {
        orphanedActionCount += 1;
        issues.push({
          code: ISSUE_CODES.ORPHANED_ACTION_INTENT,
          severity: ISSUE_SEVERITY.WARNING,
          message: `Action "${action.id}" references intent "${action.intentId}" with no registered handler.`,
          nodeId: action.id,
        });
      }
    }
  }

  const metrics: ViewEvolutionMetrics = {
    nodesReplaced,
    nodesPatchedInPlace,
    replacementRatio,
    semanticKeyChurnCount,
    continuityLossCount,
    detachedFieldDelta,
    maxLayoutDepthPrior,
    maxLayoutDepthNext,
    layoutDepthDelta,
    orphanedActionCount,
  };

  return { issues, metrics };
}
