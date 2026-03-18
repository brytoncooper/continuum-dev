import type {
  CollectionNode,
  GridNode,
  GroupNode,
  RowNode,
  ViewNode,
} from '@continuum-dev/contract';

export type ChildContainerNode = GroupNode | RowNode | GridNode;

export function isChildContainerNode(
  node: ViewNode
): node is ChildContainerNode {
  return node.type === 'group' || node.type === 'row' || node.type === 'grid';
}

export function isCollectionNode(node: ViewNode): node is CollectionNode {
  return node.type === 'collection';
}

export function stripStructuralChildren(
  node: ChildContainerNode
): Omit<ChildContainerNode, 'children'> {
  const { children: _children, ...rest } = node;
  return rest;
}

export function stripCollectionTemplate(
  node: CollectionNode
): Omit<CollectionNode, 'template'> {
  const { template: _template, ...rest } = node;
  return rest;
}
