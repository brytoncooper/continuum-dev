import { memo, useCallback, useContext, useMemo } from 'react';
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
  mappedProps?: Record<string, unknown>;
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

const StatefulNodeRenderer = memo(function StatefulNodeRenderer({
  definition,
  parentPath,
  mappedProps,
}: NodeRendererProps) {
  const Component = useResolvedComponent(definition);
  const canonicalId = toCanonicalId(definition.id, parentPath);

  const [value, setValue] = useContinuumState(canonicalId);

  if (definition.hidden) {
    return null;
  }

  return (
    <>
      <NodeErrorBoundary nodeId={definition.id}>
        <Component
          value={value}
          onChange={setValue}
          definition={definition}
          nodeId={canonicalId}
          {...mappedProps}
        />
      </NodeErrorBoundary>
    </>
  );
});

const ContainerNodeRenderer = memo(function ContainerNodeRenderer({
  definition,
  parentPath,
  mappedProps,
}: NodeRendererProps) {
  const Component = useResolvedComponent(definition);

  if (definition.hidden) {
    return null;
  }

  const canonicalId = toCanonicalId(definition.id, parentPath);
  const childNodes = getChildNodes(definition).map((child) => (
    <NodeRenderer
      key={child.id}
      definition={child}
      parentPath={canonicalId}
      mappedProps={mappedProps}
    />
  ));

  return (
    <>
      <NodeErrorBoundary nodeId={definition.id}>
        <Component
          value={undefined}
          onChange={noopOnChange}
          definition={definition}
          nodeId={canonicalId}
          {...mappedProps}
        >
          {childNodes}
        </Component>
      </NodeErrorBoundary>
    </>
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
  const parentScope = useContext(NodeStateScopeContext);
  if (!ctx) {
    throw new Error(
      'ContinuumRenderer must be used within a <ContinuumProvider>'
    );
  }
  const { session, store } = ctx;
  const scope = useMemo(
    () => {
      const readCollectionValue = parentScope
        ? () => normalizeCollectionNodeValue(parentScope.getNodeValue(collectionCanonicalId))
        : () => normalizeCollectionNodeValue(store.getNodeValue(collectionCanonicalId));

      const writeCollectionValue = parentScope
        ? (next: NodeValue<CollectionNodeState>) => parentScope.setNodeValue(collectionCanonicalId, next)
        : (next: NodeValue<CollectionNodeState>) => session.updateState(collectionCanonicalId, next);

      const subscribeToCollection = parentScope
        ? (listener: () => void) => parentScope.subscribeNode(collectionCanonicalId, listener)
        : (listener: () => void) => store.subscribeNode(collectionCanonicalId, listener);

      return {
        subscribeNode: (_nodeId: string, listener: () => void) =>
          subscribeToCollection(listener),
        getNodeValue: (nodeId: string) => {
          const relativeId = toRelativeNodeId(collectionCanonicalId, nodeId);
          if (!relativeId) {
            return undefined;
          }
          const collectionValue = readCollectionValue();
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
          const collectionValue = readCollectionValue();
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
          writeCollectionValue({
            ...collectionValue,
            value: { items },
          });
        },
      };
    },
    [collectionCanonicalId, itemIndex, session, store, templateDefaults, parentScope]
  );

  return (
    <NodeStateScopeContext.Provider value={scope}>
      <NodeRenderer
        definition={template}
        parentPath={collectionCanonicalId}
        mappedProps={{
          itemIndex,
          canRemove,
          onRemove: () => onRemove(itemIndex),
        }}
      />
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
  const ctx = useContext(ContinuumContext);
  const parentScope = useContext(NodeStateScopeContext);
  if (!ctx) {
    throw new Error(
      'ContinuumRenderer must be used within a <ContinuumProvider>'
    );
  }
  const { store } = ctx;
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

  const readCollectionValue = useCallback(
    () =>
      normalizeCollectionNodeValue(
        parentScope
          ? parentScope.getNodeValue(canonicalId)
          : store.getNodeValue(canonicalId)
      ),
    [canonicalId, parentScope, store]
  );

  const addItem = useCallback(() => {
    const current = readCollectionValue();
    if (maxItems !== undefined && current.value.items.length >= maxItems) {
      return;
    }
    const items = [
      ...current.value.items.map((item) => ({
        values: { ...item.values },
      })),
      { values: { ...templateDefaults } },
    ];
    setCollectionValue({
      ...current,
      value: { items },
    });
  }, [maxItems, readCollectionValue, setCollectionValue, templateDefaults]);

  const removeItem = useCallback((index: number) => {
    const current = readCollectionValue();
    if (current.value.items.length <= minItems) {
      return;
    }
    const items = current.value.items
      .map((item) => ({ values: { ...item.values } }))
      .filter((_, itemIndex) => itemIndex !== index);
    if (items.length < minItems) {
      return;
    }
    setCollectionValue({
      ...current,
      value: { items },
    });
  }, [minItems, readCollectionValue, setCollectionValue]);

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
    <>
      <NodeErrorBoundary nodeId={definition.id}>
        <Component
          value={collectionValue}
          onChange={setCollectionValue}
          definition={definition}
          nodeId={canonicalId}
          canAdd={canAdd}
          canRemove={canRemove}
          onAdd={addItem}
          onRemove={removeItem}
        >
          {renderedItems}
        </Component>
      </NodeErrorBoundary>
    </>
  );
});

const NodeRenderer = memo(function NodeRenderer({
  definition,
  parentPath,
  mappedProps,
}: NodeRendererProps) {
  if (definition.type === 'collection') {
    return <CollectionNodeRenderer definition={definition} parentPath={parentPath} />;
  }
  const childNodes = getChildNodes(definition);
  if (childNodes.length > 0) {
    return <ContainerNodeRenderer definition={definition} parentPath={parentPath} mappedProps={mappedProps} />;
  }
  return <StatefulNodeRenderer definition={definition} parentPath={parentPath} mappedProps={mappedProps} />;
});

/**
 * Renders a `ViewDefinition` tree using components registered in `ContinuumProvider`.
 */
export function ContinuumRenderer({ view }: { view: ViewDefinition }) {
  return (
    <>
      {(view.nodes ?? []).map((node) => (
        <NodeRenderer key={node.id} definition={node} parentPath="" />
      ))}
    </>
  );
}
