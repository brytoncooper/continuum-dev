import { memo, useContext, useMemo } from 'react';
import type {
  CollectionNode,
  CollectionNodeState,
  NodeValue,
  ViewDefinition,
  ViewNode,
} from '@continuum/contract';
import { getChildNodes } from '@continuum/contract';
import { ContinuumContext } from './context.js';
import { NodeStateScopeContext, useContinuumState } from './hooks.js';
import { FallbackComponent } from './fallback.js';
import { NodeErrorBoundary } from './error-boundary.js';

const noopOnChange = () => undefined;

function toCanonicalId(id: string, parentPath: string): string {
  return parentPath.length > 0 ? `${parentPath}/${id}` : id;
}

function useResolvedComponent(definition: ViewNode) {
  const ctx = useContext(ContinuumContext);
  if (!ctx) {
    throw new Error(
      'ContinuumRenderer must be used within a <ContinuumProvider>'
    );
  }

  const { componentMap } = ctx;
  return (
    componentMap[definition.type] ??
    componentMap['default'] ??
    FallbackComponent
  );
}

interface NodeRendererProps {
  definition: ViewNode;
  parentPath: string;
}

function normalizeCollectionNodeValue(
  value: NodeValue | undefined
): NodeValue<CollectionNodeState> {
  const items = (value as NodeValue<CollectionNodeState> | undefined)?.value?.items;
  if (!Array.isArray(items)) {
    return { value: { items: [] } };
  }
  return {
    ...value,
    value: {
      items: items.map((item) => ({
        values:
          item && typeof item === 'object' && item.values && typeof item.values === 'object'
            ? { ...item.values }
            : {},
      })),
    },
  } as NodeValue<CollectionNodeState>;
}

function toRelativeNodeId(
  collectionCanonicalId: string,
  nodeId: string
): string | null {
  if (nodeId === collectionCanonicalId) {
    return null;
  }
  if (nodeId.startsWith(`${collectionCanonicalId}/`)) {
    return nodeId.slice(collectionCanonicalId.length + 1);
  }
  return null;
}

function normalizeMinItems(value: number | undefined): number {
  if (value === undefined || value < 0) {
    return 0;
  }
  return Math.floor(value);
}

function normalizeMaxItems(value: number | undefined): number | undefined {
  if (value === undefined || value < 0) {
    return undefined;
  }
  return Math.floor(value);
}

function createInitialCollectionState(node: CollectionNode): CollectionNodeState {
  const minItems = normalizeMinItems(node.minItems);
  return {
    items: Array.from({ length: minItems }, () => ({
      values: collectTemplateDefaults(node.template),
    })),
  };
}

function collectTemplateDefaults(
  node: ViewNode,
  parentPath = ''
): Record<string, NodeValue> {
  const nodeId = toCanonicalId(node.id, parentPath);
  if (node.type === 'collection') {
    return {
      [nodeId]: {
        value: createInitialCollectionState(node),
      } as NodeValue<CollectionNodeState>,
    };
  }
  const values: Record<string, NodeValue> = {};
  if ('defaultValue' in node && node.defaultValue !== undefined) {
    values[nodeId] = { value: node.defaultValue };
  }
  const children = getChildNodes(node);
  for (const child of children) {
    Object.assign(values, collectTemplateDefaults(child, nodeId));
  }
  return values;
}

const StatefulNodeRenderer = memo(function StatefulNodeRenderer({ definition, parentPath }: NodeRendererProps) {
  const Component = useResolvedComponent(definition);
  const canonicalId = toCanonicalId(definition.id, parentPath);

  const [value, setValue] = useContinuumState(canonicalId);

  if (definition.hidden) {
    return null;
  }

  return (
    <div data-continuum-id={definition.id}>
      <NodeErrorBoundary nodeId={definition.id}>
        <Component
          value={value}
          onChange={setValue}
          definition={definition}
          nodeId={canonicalId}
        />
      </NodeErrorBoundary>
    </div>
  );
});

const ContainerNodeRenderer = memo(function ContainerNodeRenderer({ definition, parentPath }: NodeRendererProps) {
  const Component = useResolvedComponent(definition);

  if (definition.hidden) {
    return null;
  }

  const canonicalId = toCanonicalId(definition.id, parentPath);
  const childNodes = getChildNodes(definition).map((child) => (
    <NodeRenderer key={child.id} definition={child} parentPath={canonicalId} />
  ));

  return (
    <div data-continuum-id={definition.id}>
      <NodeErrorBoundary nodeId={definition.id}>
        <Component
          value={undefined}
          onChange={noopOnChange}
          definition={definition}
          nodeId={canonicalId}
        >
          {childNodes}
        </Component>
      </NodeErrorBoundary>
    </div>
  );
});

interface CollectionItemRendererProps {
  collectionCanonicalId: string;
  itemIndex: number;
  template: ViewNode;
  templateDefaults: Record<string, NodeValue>;
  canRemove: boolean;
  onRemove: (index: number) => void;
}

const CollectionItemRenderer = memo(function CollectionItemRenderer({
  collectionCanonicalId,
  itemIndex,
  template,
  templateDefaults,
  canRemove,
  onRemove,
}: CollectionItemRendererProps) {
  const ctx = useContext(ContinuumContext);
  if (!ctx) {
    throw new Error(
      'ContinuumRenderer must be used within a <ContinuumProvider>'
    );
  }
  const { session, store } = ctx;
  const scope = useMemo(
    () => ({
      subscribeNode: (_nodeId: string, listener: () => void) =>
        store.subscribeNode(collectionCanonicalId, listener),
      getNodeValue: (nodeId: string) => {
        const relativeId = toRelativeNodeId(collectionCanonicalId, nodeId);
        if (!relativeId) {
          return undefined;
        }
        const collectionValue = normalizeCollectionNodeValue(
          store.getNodeValue(collectionCanonicalId)
        );
        return (
          collectionValue.value.items[itemIndex]?.values?.[relativeId] ??
          templateDefaults[relativeId]
        );
      },
      setNodeValue: (nodeId: string, nextValue: NodeValue) => {
        const relativeId = toRelativeNodeId(collectionCanonicalId, nodeId);
        if (!relativeId) {
          return;
        }
        const collectionValue = normalizeCollectionNodeValue(
          store.getNodeValue(collectionCanonicalId)
        );
        const items = collectionValue.value.items.map((item) => ({
          values: { ...item.values },
        }));
        while (items.length <= itemIndex) {
          items.push({ values: {} });
        }
        items[itemIndex] = {
          values: {
            ...items[itemIndex].values,
            [relativeId]: nextValue,
          },
        };
        session.updateState(collectionCanonicalId, {
          ...collectionValue,
          value: { items },
        });
      },
    }),
    [collectionCanonicalId, itemIndex, session, store, templateDefaults]
  );

  return (
    <NodeStateScopeContext.Provider value={scope}>
      <div
        data-continuum-collection-item={`${collectionCanonicalId}:${itemIndex}`}
        className="continuum-collection-item"
      >
        <NodeRenderer definition={template} parentPath={collectionCanonicalId} />
        {canRemove ? (
          <div className="continuum-collection-item-actions">
            <button
              type="button"
              data-continuum-collection-remove={`${collectionCanonicalId}:${itemIndex}`}
              onClick={() => onRemove(itemIndex)}
              className="continuum-collection-remove"
            >
              ×
            </button>
          </div>
        ) : null}
      </div>
    </NodeStateScopeContext.Provider>
  );
});

const CollectionNodeRenderer = memo(function CollectionNodeRenderer({
  definition,
  parentPath,
}: {
  definition: CollectionNode;
  parentPath: string;
}) {
  const Component = useResolvedComponent(definition);
  const canonicalId = toCanonicalId(definition.id, parentPath);
  const [collectionValue, setCollectionValue] = useContinuumState(canonicalId);
  const normalizedCollection = normalizeCollectionNodeValue(collectionValue);
  const minItems = normalizeMinItems(definition.minItems);
  const maxItems = normalizeMaxItems(definition.maxItems);
  const templateDefaults = useMemo(
    () => collectTemplateDefaults(definition.template),
    [definition.template]
  );
  const canAdd =
    maxItems === undefined ||
    normalizedCollection.value.items.length < maxItems;
  const canRemove = normalizedCollection.value.items.length > minItems;

  if (definition.hidden) {
    return null;
  }

  const addItem = () => {
    if (!canAdd) {
      return;
    }
    const items = [
      ...normalizedCollection.value.items.map((item) => ({
        values: { ...item.values },
      })),
      { values: { ...templateDefaults } },
    ];
    setCollectionValue({
      ...normalizedCollection,
      value: { items },
    });
  };

  const removeItem = (index: number) => {
    if (!canRemove) {
      return;
    }
    const items = normalizedCollection.value.items
      .map((item) => ({ values: { ...item.values } }))
      .filter((_, itemIndex) => itemIndex !== index);
    if (items.length < minItems) {
      return;
    }
    setCollectionValue({
      ...normalizedCollection,
      value: { items },
    });
  };

  const renderedItems = normalizedCollection.value.items.map((_, index) => (
    <CollectionItemRenderer
      key={index}
      collectionCanonicalId={canonicalId}
      itemIndex={index}
      template={definition.template}
      templateDefaults={templateDefaults}
      canRemove={canRemove}
      onRemove={removeItem}
    />
  ));

  return (
    <div data-continuum-id={definition.id}>
      <NodeErrorBoundary nodeId={definition.id}>
        <Component
          value={collectionValue}
          onChange={setCollectionValue}
          definition={definition}
          nodeId={canonicalId}
        >
          {renderedItems}
          <div className="continuum-collection-add-container">
            <button
              type="button"
              data-continuum-collection-add={canonicalId}
              onClick={addItem}
              disabled={!canAdd}
              className="continuum-collection-add"
            >
              + Add item
            </button>
          </div>
        </Component>
      </NodeErrorBoundary>
    </div>
  );
});

const NodeRenderer = memo(function NodeRenderer({ definition, parentPath }: NodeRendererProps) {
  if (definition.type === 'collection') {
    return <CollectionNodeRenderer definition={definition} parentPath={parentPath} />;
  }
  const childNodes = getChildNodes(definition);
  if (childNodes.length > 0) {
    return <ContainerNodeRenderer definition={definition} parentPath={parentPath} />;
  }
  return <StatefulNodeRenderer definition={definition} parentPath={parentPath} />;
});

/**
 * Renders a `ViewDefinition` tree using components registered in `ContinuumProvider`.
 */
export function ContinuumRenderer({ view }: { view: ViewDefinition }) {
  return (
    <div data-continuum-view={view.viewId}>
      {(view.nodes ?? []).map((node) => (
        <NodeRenderer key={node.id} definition={node} parentPath="" />
      ))}
    </div>
  );
}
