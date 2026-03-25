import type {
  PresentationNode,
  ViewDefinition,
  ViewNode,
} from '@continuum-dev/contract';
import {
  applyContinuumViewPatch,
  collectContinuumViewPatchAffectedNodeIds,
  type ContinuumViewPatch,
} from '../view-patch/index.js';
import { patchViewDefinition } from '../view-patch/index.js';
import type {
  ApplyContinuumViewStreamPartInput,
  ApplyContinuumViewStreamPartResult,
} from './types.js';

function resolveUniqueNodeIdBySemanticKey(
  nodes: ViewNode[],
  semanticKey: string
): string | null {
  const matches: string[] = [];

  const walk = (items: ViewNode[]) => {
    for (const node of items) {
      if (node.semanticKey === semanticKey) {
        matches.push(node.id);
      }

      if ('children' in node && Array.isArray(node.children)) {
        walk(node.children);
      } else if (node.type === 'collection') {
        walk([node.template]);
      }
    }
  };

  walk(nodes);
  return matches.length === 1 ? matches[0]! : null;
}

function appendContentToNode(
  node: ViewNode,
  nodeId: string,
  text: string
): { nextNode: ViewNode; changed: boolean; affectedCanonicalId?: string } {
  if (node.id === nodeId || nodeId.endsWith(`/${node.id}`)) {
    if (node.type !== 'presentation') {
      throw new Error(
        `append-content requires a presentation node, received ${node.type} for ${nodeId}`
      );
    }

    const nextNode: PresentationNode = {
      ...node,
      content: `${node.content}${text}`,
    };
    return { nextNode, changed: true };
  }

  if ('children' in node && Array.isArray(node.children)) {
    let changed = false;
    const nextChildren = node.children.map((child) => {
      const childResult = appendContentToNode(child, nodeId, text);
      changed = changed || childResult.changed;
      return childResult.nextNode;
    });

    if (changed) {
      return {
        nextNode: {
          ...node,
          children: nextChildren,
        },
        changed: true,
      };
    }
  }

  if (node.type === 'collection') {
    const templateResult = appendContentToNode(node.template, nodeId, text);
    if (templateResult.changed) {
      return {
        nextNode: {
          ...node,
          template: templateResult.nextNode,
        },
        changed: true,
      };
    }
  }

  return { nextNode: node, changed: false };
}

function buildPatchForStructuralPart(
  currentView: ViewDefinition,
  part: ApplyContinuumViewStreamPartInput['part']
): {
  patch: ContinuumViewPatch;
  affectedNodeIds: string[];
} {
  switch (part.kind) {
    case 'patch':
      return {
        patch: part.patch,
        affectedNodeIds: collectContinuumViewPatchAffectedNodeIds(part.patch),
      };
    case 'insert-node': {
      const patch: ContinuumViewPatch = {
        viewId: currentView.viewId,
        version: currentView.version,
        operations: [
          {
            op: 'insert-node',
            parentId: part.parentId,
            parentSemanticKey: part.parentSemanticKey,
            position: part.position,
            node: part.node,
          },
        ],
      };
      return {
        patch,
        affectedNodeIds: collectContinuumViewPatchAffectedNodeIds(patch),
      };
    }
    case 'move-node': {
      const patch: ContinuumViewPatch = {
        viewId: currentView.viewId,
        version: currentView.version,
        operations: [
          {
            op: 'move-node',
            nodeId: part.nodeId,
            semanticKey: part.semanticKey,
            parentId: part.parentId,
            parentSemanticKey: part.parentSemanticKey,
            position: part.position,
          },
        ],
      };
      return {
        patch,
        affectedNodeIds: collectContinuumViewPatchAffectedNodeIds(patch),
      };
    }
    case 'wrap-nodes': {
      const patch: ContinuumViewPatch = {
        viewId: currentView.viewId,
        version: currentView.version,
        operations: [
          {
            op: 'wrap-nodes',
            parentId: part.parentId,
            parentSemanticKey: part.parentSemanticKey,
            nodeIds: part.nodeIds,
            semanticKeys: part.semanticKeys,
            wrapper: part.wrapper,
          },
        ],
      };
      return {
        patch,
        affectedNodeIds: collectContinuumViewPatchAffectedNodeIds(patch),
      };
    }
    case 'replace-node': {
      const patch: ContinuumViewPatch = {
        viewId: currentView.viewId,
        version: currentView.version,
        operations: [
          {
            op: 'replace-node',
            nodeId: part.nodeId,
            semanticKey: part.semanticKey,
            node: part.node,
          },
        ],
      };
      return {
        patch,
        affectedNodeIds: collectContinuumViewPatchAffectedNodeIds(patch),
      };
    }
    case 'remove-node': {
      const patch: ContinuumViewPatch = {
        viewId: currentView.viewId,
        version: currentView.version,
        operations: [
          {
            op: 'remove-node',
            nodeId: part.nodeId,
            semanticKey: part.semanticKey,
          },
        ],
      };
      return {
        patch,
        affectedNodeIds: collectContinuumViewPatchAffectedNodeIds(patch),
      };
    }
    default:
      throw new Error(`Unsupported structural part: ${String(part)}`);
  }
}

/**
 * Applies one streamed structural part to the current view.
 */
export function applyContinuumViewStreamPart(
  input: ApplyContinuumViewStreamPartInput
): ApplyContinuumViewStreamPartResult {
  const { part } = input;
  if (part.kind === 'append-content') {
    const targetNodeId =
      part.nodeId ??
      (typeof part.semanticKey === 'string'
        ? resolveUniqueNodeIdBySemanticKey(
            input.currentView.nodes,
            part.semanticKey
          ) ?? undefined
        : undefined);
    if (!targetNodeId) {
      throw new Error('append-content could not resolve a unique target node');
    }

    let changed = false;
    const nextNodes = input.currentView.nodes.map((node) => {
      const result = appendContentToNode(node, targetNodeId, part.text);
      changed = changed || result.changed;
      return result.nextNode;
    });

    if (!changed) {
      throw new Error(
        `append-content could not find node ${targetNodeId} in the current view`
      );
    }

    return {
      view: patchViewDefinition(input.currentView, {
        ...input.currentView,
        nodes: nextNodes,
      }),
      affectedNodeIds: [targetNodeId],
      incrementalHint: 'presentation-content',
    };
  }

  const { patch, affectedNodeIds } = buildPatchForStructuralPart(
    input.currentView,
    part
  );
  return {
    view: applyContinuumViewPatch(input.currentView, patch),
    affectedNodeIds,
  };
}
