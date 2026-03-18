import { memo, useCallback, useContext, useMemo } from 'react';
import type {
  CollectionNode,
  CollectionNodeState,
  NodeValue,
  ViewNode,
} from '@continuum-dev/core';
import { getChildNodes } from '@continuum-dev/core';
import { ContinuumContext } from '../context/render-contexts.js';
import { NodeErrorBoundary } from '../error-boundary.js';
import { FallbackComponent } from '../fallback.js';
import { NodeStateScopeContext } from '../hooks/scope.js';
import { useContinuumState } from '../hooks/state.js';
import {
  clearCollectionItemSuggestion,
  collectTemplateDefaults,
  deepCloneValues,
  mergeCollectionItemSuggestion,
  normalizeCollectionNodeValue,
  normalizeMaxItems,
  normalizeMinItems,
} from './collection-state.js';
import { toCanonicalId, toRelativeNodeId } from './paths.js';
import { useStreamingMappedProps } from './streaming.js';

const noopOnChange = () => undefined;

export interface NodeRendererProps {
  definition: ViewNode;
  parentPath: string;
  mappedProps?: Record<string, unknown>;
}

export function useResolvedComponent(definition: ViewNode) {
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

export const StatefulNodeRenderer = memo(function StatefulNodeRenderer({
  definition,
  parentPath,
  mappedProps,
}: NodeRendererProps) {
  const Component = useResolvedComponent(definition);
  const canonicalId = toCanonicalId(definition.id, parentPath);
  const streamingProps = useStreamingMappedProps(canonicalId, mappedProps);

  const [value, setValue] = useContinuumState(canonicalId);
  const hasSuggestion = (value as NodeValue | undefined)?.suggestion !== undefined;
  const suggestionValue = (value as NodeValue | undefined)?.suggestion;

  if (definition.hidden) {
    return null;
  }

  return (
    <>
      <NodeErrorBoundary nodeId={definition.id}>
        <Component
          value={value}
          hasSuggestion={hasSuggestion}
          suggestionValue={suggestionValue}
          onChange={setValue}
          definition={definition}
          nodeId={canonicalId}
          {...streamingProps}
        />
      </NodeErrorBoundary>
    </>
  );
});

export const ContainerNodeRenderer = memo(function ContainerNodeRenderer({
  definition,
  parentPath,
  mappedProps,
}: NodeRendererProps) {
  const Component = useResolvedComponent(definition);

  if (definition.hidden) {
    return null;
  }

  const canonicalId = toCanonicalId(definition.id, parentPath);
  const streamingProps = useStreamingMappedProps(canonicalId, mappedProps);
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
          {...streamingProps}
        >
          {childNodes}
        </Component>
      </NodeErrorBoundary>
    </>
  );
});

export interface CollectionItemRendererProps {
  collectionCanonicalId: string;
  itemIndex: number;
  template: ViewNode;
  templateDefaults: Record<string, NodeValue>;
  canRemove: boolean;
  onRemove: (index: number) => void;
}

export const CollectionItemRenderer = memo(function CollectionItemRenderer({
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
  const scope = useMemo(() => {
    const readCollectionValue = parentScope
      ? () =>
          normalizeCollectionNodeValue(
            parentScope.getNodeValue(collectionCanonicalId)
          )
      : () =>
          normalizeCollectionNodeValue(
            store.getNodeValue(collectionCanonicalId)
          );

    const writeCollectionValue = parentScope
      ? (next: NodeValue<CollectionNodeState>) =>
          parentScope.setNodeValue(collectionCanonicalId, next)
      : (next: NodeValue<CollectionNodeState>) =>
          session.updateState(collectionCanonicalId, next);

    const subscribeToCollection = parentScope
      ? (listener: () => void) =>
          parentScope.subscribeNode(collectionCanonicalId, listener)
      : (listener: () => void) =>
          store.subscribeNode(collectionCanonicalId, listener);

    return {
      subscribeNode: (_nodeId: string, listener: () => void) =>
        subscribeToCollection(listener),
      getNodeValue: (nodeId: string) => {
        const relativeId = toRelativeNodeId(collectionCanonicalId, nodeId);
        if (!relativeId) {
          return undefined;
        }
        const collectionValue = readCollectionValue();
        const itemValue =
          collectionValue.value.items[itemIndex]?.values?.[relativeId] ??
          templateDefaults[relativeId];
        const collectionSuggestion =
          collectionValue.suggestion as CollectionNodeState | undefined;

        return mergeCollectionItemSuggestion(
          itemValue,
          collectionSuggestion,
          itemIndex,
          relativeId
        );
      },
      setNodeValue: (nodeId: string, nextValue: NodeValue) => {
        const relativeId = toRelativeNodeId(collectionCanonicalId, nodeId);
        if (!relativeId) {
          return;
        }
        const collectionValue = readCollectionValue();
        const items = collectionValue.value.items.map((item) => ({
          values: deepCloneValues(item.values),
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
        const nextCollectionSuggestion = clearCollectionItemSuggestion(
          collectionValue.suggestion as CollectionNodeState | undefined,
          itemIndex,
          relativeId
        );
        const nextCollectionValue = {
          ...collectionValue,
          value: { items },
          ...(nextCollectionSuggestion !== undefined
            ? { suggestion: nextCollectionSuggestion }
            : {}),
        } as NodeValue<CollectionNodeState>;

        if (nextCollectionSuggestion === undefined) {
          delete nextCollectionValue.suggestion;
        }

        writeCollectionValue(nextCollectionValue);
      },
    };
  }, [
    collectionCanonicalId,
    itemIndex,
    session,
    store,
    templateDefaults,
    parentScope,
  ]);

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

export const CollectionNodeRenderer = memo(function CollectionNodeRenderer({
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
  const streamingProps = useStreamingMappedProps(canonicalId);
  const [collectionValue, setCollectionValue] = useContinuumState(canonicalId);
  const normalizedCollection = normalizeCollectionNodeValue(collectionValue);
  const hasSuggestion = normalizedCollection.suggestion !== undefined;
  const suggestionValue = normalizedCollection.suggestion;
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
        values: deepCloneValues(item.values),
      })),
      { values: deepCloneValues(templateDefaults) },
    ];
    setCollectionValue({
      ...current,
      value: { items },
    });
  }, [maxItems, readCollectionValue, setCollectionValue, templateDefaults]);

  const removeItem = useCallback(
    (index: number) => {
      const current = readCollectionValue();
      if (current.value.items.length <= minItems) {
        return;
      }
      const items = current.value.items
        .map((item) => ({ values: deepCloneValues(item.values) }))
        .filter((_, itemIndex) => itemIndex !== index);
      if (items.length < minItems) {
        return;
      }
      setCollectionValue({
        ...current,
        value: { items },
      });
    },
    [minItems, readCollectionValue, setCollectionValue]
  );

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
          value={normalizedCollection}
          hasSuggestion={hasSuggestion}
          suggestionValue={suggestionValue}
          onChange={setCollectionValue}
          definition={definition}
          nodeId={canonicalId}
          canAdd={canAdd}
          canRemove={canRemove}
          onAdd={addItem}
          onRemove={removeItem}
          {...streamingProps}
        >
          {renderedItems}
        </Component>
      </NodeErrorBoundary>
    </>
  );
});

export const NodeRenderer = memo(function NodeRenderer({
  definition,
  parentPath,
  mappedProps,
}: NodeRendererProps) {
  if (definition.type === 'collection') {
    return (
      <CollectionNodeRenderer definition={definition} parentPath={parentPath} />
    );
  }
  const childNodes = getChildNodes(definition);
  if (childNodes.length > 0) {
    return (
      <ContainerNodeRenderer
        definition={definition}
        parentPath={parentPath}
        mappedProps={mappedProps}
      />
    );
  }
  return (
    <StatefulNodeRenderer
      definition={definition}
      parentPath={parentPath}
      mappedProps={mappedProps}
    />
  );
});
