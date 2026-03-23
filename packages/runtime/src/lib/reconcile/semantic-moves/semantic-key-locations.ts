import type { ViewNode } from '@continuum-dev/contract';
import { getChildNodes } from '@continuum-dev/contract';

export type StructuralLevel = 'top' | 'collection';

export interface SemanticKeyLocation {
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

export function collectSemanticKeyLocations(
  nodes: ViewNode[]
): SemanticKeyLocation[] {
  const locations: SemanticKeyLocation[] = [];
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

    if (frame.node.semanticKey) {
      locations.push(buildLocation(frame, frame.node.semanticKey));
    }

    for (
      let index = getChildNodes(frame.node).length - 1;
      index >= 0;
      index -= 1
    ) {
      const child = getChildNodes(frame.node)[index];
      const childNodeId = `${frame.nodeId}/${child.id}`;
      if (frame.node.type === 'collection') {
        stack.push({
          node: child,
          nodeId: childNodeId,
          inCollection: true,
          outerCollectionId: frame.inCollection
            ? frame.outerCollectionId
            : frame.nodeId,
          relativePath: frame.inCollection
            ? `${frame.relativePath}/${child.id}`
            : child.id,
          collectionPathStack: frame.inCollection
            ? frame.collectionPathStack
            : [''],
        });
        continue;
      }

      if (frame.inCollection) {
        const relativePath = `${frame.relativePath}/${child.id}`;
        stack.push({
          node: child,
          nodeId: childNodeId,
          inCollection: true,
          outerCollectionId: frame.outerCollectionId,
          relativePath,
          collectionPathStack:
            child.type === 'collection'
              ? [...frame.collectionPathStack, relativePath]
              : frame.collectionPathStack,
        });
        continue;
      }

      stack.push({
        node: child,
        nodeId: childNodeId,
        inCollection: false,
        collectionPathStack: [],
      });
    }
  }

  return locations;
}

function buildLocation(
  frame: TraverseFrame,
  token: string
): SemanticKeyLocation {
  if (!frame.inCollection) {
    return {
      token,
      node: frame.node,
      nodeId: frame.nodeId,
      level: 'top',
    };
  }

  return {
    token,
    node: frame.node,
    nodeId: frame.nodeId,
    level: 'collection',
    outerCollectionId: frame.outerCollectionId,
    pathChain: buildPathChain(
      frame.relativePath ?? '',
      frame.collectionPathStack
    ),
  };
}

function buildPathChain(
  relativePath: string,
  collectionPathStack: string[]
): string[] {
  const chain: string[] = [];
  for (const path of collectionPathStack.slice(1)) {
    chain.push(path);
  }

  const anchor =
    collectionPathStack.length > 0
      ? collectionPathStack[collectionPathStack.length - 1]
      : '';
  const finalPath =
    anchor.length > 0 && relativePath.startsWith(`${anchor}/`)
      ? relativePath.slice(anchor.length + 1)
      : relativePath;

  if (finalPath.length > 0 && chain[chain.length - 1] !== finalPath) {
    chain.push(finalPath);
  }

  return chain;
}
