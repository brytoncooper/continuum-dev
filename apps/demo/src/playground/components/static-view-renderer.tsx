import { getChildNodes } from '@continuum/contract';
import type { CollectionNode, CollectionNodeState, NodeValue, ViewDefinition, ViewNode } from '@continuum/contract';
import type { ContinuumNodeMap, ContinuumNodeProps } from '@continuum/react';
import { componentMap } from '../../component-map';

function scopedNodeId(nodeId: string, parentNodeId?: string): string {
  return parentNodeId ? `${parentNodeId}/${nodeId}` : nodeId;
}

function renderCollectionItemNode(
  node: ViewNode,
  itemValues: Record<string, NodeValue>,
  collectionNodeId: string,
  itemIndex: number,
  components: ContinuumNodeMap,
  relativeParentId?: string
): JSX.Element {
  const relativeNodeId = scopedNodeId(node.id, relativeParentId);
  const nodeId = scopedNodeId(relativeNodeId, collectionNodeId);
  const Component = (components[node.type] ?? components.default) as (
    props: ContinuumNodeProps
  ) => JSX.Element;
  const children = getChildNodes(node);

  return (
    <Component
      key={`${nodeId}:${itemIndex}`}
      definition={node}
      nodeId={nodeId}
      value={itemValues[relativeNodeId]}
      onChange={() => undefined}
      itemIndex={itemIndex}
      canRemove={false}
    >
      {children.map((childNode) =>
        renderCollectionItemNode(
          childNode,
          itemValues,
          collectionNodeId,
          itemIndex,
          components,
          relativeNodeId
        )
      )}
    </Component>
  );
}

function renderCollectionNode(
  node: CollectionNode,
  values: Record<string, NodeValue>,
  components: ContinuumNodeMap,
  parentNodeId?: string
): JSX.Element {
  const nodeId = scopedNodeId(node.id, parentNodeId);
  const Component = (components[node.type] ?? components.default) as (
    props: ContinuumNodeProps
  ) => JSX.Element;
  const collectionValue =
    (values[nodeId] as NodeValue<CollectionNodeState> | undefined)?.value?.items ?? [];

  return (
    <Component
      key={nodeId}
      definition={node}
      nodeId={nodeId}
      value={values[nodeId]}
      onChange={() => undefined}
      canAdd={false}
      canRemove={false}
    >
      {collectionValue.map((item, itemIndex) =>
        renderCollectionItemNode(
          node.template,
          item.values ?? {},
          nodeId,
          itemIndex,
          components
        )
      )}
    </Component>
  );
}

function renderNode(
  node: ViewNode,
  values: Record<string, NodeValue>,
  onChange: (nodeId: string, value: NodeValue) => void,
  components: ContinuumNodeMap,
  parentNodeId?: string
): JSX.Element {
  if (node.type === 'collection') {
    return renderCollectionNode(node as CollectionNode, values, components, parentNodeId);
  }

  const nodeId = scopedNodeId(node.id, parentNodeId);
  const Component = (components[node.type] ?? components.default) as (
    props: ContinuumNodeProps
  ) => JSX.Element;
  const children = getChildNodes(node);

  return (
    <Component
      key={nodeId}
      definition={node}
      nodeId={nodeId}
      value={values[nodeId]}
      onChange={(value) => onChange(nodeId, value as NodeValue)}
    >
      {children.map((childNode) => renderNode(childNode, values, onChange, components, nodeId))}
    </Component>
  );
}

export function StaticViewRenderer({
  view,
  values,
  onChange,
  components = componentMap,
}: {
  view: ViewDefinition;
  values: Record<string, NodeValue>;
  onChange: (nodeId: string, value: NodeValue) => void;
  components?: ContinuumNodeMap;
}) {
  return <>{view.nodes.map((node) => renderNode(node, values, onChange, components))}</>;
}
