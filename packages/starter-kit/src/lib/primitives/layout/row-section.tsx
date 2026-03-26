import { getChildNodes } from '@continuum-dev/core';
import type { ContinuumNodeProps } from '@continuum-dev/react';
import { space } from '../../tokens.js';
import { ContainerShell } from '../shared/container-shell.js';
import { nodeDescription, nodeLabel, nodeNumberProp } from '../shared/node.js';
import {
  responsiveGridColumns,
  useCompactViewport,
} from '../shared/responsive-layout.js';

export function RowSection(props: ContinuumNodeProps) {
  const isCompact = useCompactViewport();
  const isCollectionItem = typeof props.itemIndex === 'number';
  const childCount = Math.max(getChildNodes(props.definition).length, 1);
  const columns = nodeNumberProp(
    props.definition,
    'columns',
    Math.min(childCount, 5)
  );
  const minWidth = nodeNumberProp(
    props.definition,
    'minItemWidth',
    childCount >= 5 ? 150 : childCount === 4 ? 160 : childCount === 3 ? 180 : 200
  );

  return (
    <ContainerShell
      title={nodeLabel(props.definition)}
      description={nodeDescription(props.definition)}
      nodeId={props.nodeId}
      itemIndex={props.itemIndex as number | undefined}
      canRemove={props.canRemove as boolean | undefined}
      onRemove={props.onRemove as (() => void) | undefined}
      itemRemovePlacement={isCollectionItem ? 'inline' : 'header'}
      itemRemoveVariant={isCollectionItem ? 'icon' : 'default'}
      layoutStyle={{
        display: 'grid',
        gridTemplateColumns: isCompact
          ? 'minmax(0, 1fr)'
          : responsiveGridColumns(columns, minWidth, space.sm),
        alignItems: 'start',
        gap: space.sm,
      }}
    >
      {props.children}
    </ContainerShell>
  );
}
