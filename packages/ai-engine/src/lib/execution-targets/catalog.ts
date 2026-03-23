import type { ViewDefinition, ViewNode } from '@continuum-dev/contract';
import { getChildNodes } from '@continuum-dev/contract';
import {
  readNodeLabel,
  SCALAR_STATEFUL_NODE_TYPES,
  toCanonicalNodeId,
} from './shared.js';
import type { ContinuumExecutionTarget } from './types.js';

function collectCollectionTemplateTargets(
  node: ViewNode,
  parentPath = ''
): ContinuumExecutionTarget[] {
  const canonicalNodeId = toCanonicalNodeId(node.id, parentPath);
  if (SCALAR_STATEFUL_NODE_TYPES.has(node.type)) {
    return [
      {
        nodeId: canonicalNodeId,
        key: node.key,
        semanticKey: node.semanticKey,
        nodeType: node.type,
        label: readNodeLabel(node),
        dataType: 'dataType' in node ? node.dataType : undefined,
        options:
          'options' in node && Array.isArray(node.options)
            ? node.options
            : undefined,
      },
    ];
  }

  return getChildNodes(node).flatMap((child) =>
    collectCollectionTemplateTargets(child, canonicalNodeId)
  );
}

export function buildContinuumStateTargetCatalog(
  view: ViewDefinition
): ContinuumExecutionTarget[] {
  const visit = (
    node: ViewNode,
    parentPath = ''
  ): ContinuumExecutionTarget[] => {
    const canonicalNodeId = toCanonicalNodeId(node.id, parentPath);

    if (node.type === 'collection') {
      return [
        {
          nodeId: canonicalNodeId,
          key: node.key,
          semanticKey: node.semanticKey,
          nodeType: node.type,
          label: readNodeLabel(node),
          templateFields: collectCollectionTemplateTargets(node.template),
        },
      ];
    }

    if (SCALAR_STATEFUL_NODE_TYPES.has(node.type)) {
      return [
        {
          nodeId: canonicalNodeId,
          key: node.key,
          semanticKey: node.semanticKey,
          nodeType: node.type,
          label: readNodeLabel(node),
          dataType: 'dataType' in node ? node.dataType : undefined,
          options:
            'options' in node && Array.isArray(node.options)
              ? node.options
              : undefined,
        },
      ];
    }

    return getChildNodes(node).flatMap((child) =>
      visit(child, canonicalNodeId)
    );
  };

  return view.nodes.flatMap((node) => visit(node));
}

export function buildContinuumPatchTargetCatalog(
  view: ViewDefinition
): ContinuumExecutionTarget[] {
  const targets: ContinuumExecutionTarget[] = [];

  const visit = (nodes: ViewNode[]): void => {
    for (const node of nodes) {
      targets.push({
        nodeId: node.id,
        key: node.key,
        semanticKey: node.semanticKey,
        nodeType: node.type,
        label: readNodeLabel(node),
      });
      visit(getChildNodes(node));
    }
  };

  visit(view.nodes);
  return targets;
}
