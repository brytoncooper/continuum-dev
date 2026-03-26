import type { CSSProperties } from 'react';
import type { ContinuumNodeProps } from '@continuum-dev/react';
import { space } from '../../tokens.js';
import { ContainerShell } from '../shared/container-shell.js';
import {
  nodeDescription,
  nodeLabel,
  nodeNumberProp,
  readNodeProp,
} from '../shared/node.js';
import {
  responsiveGridColumns,
  useCompactViewport,
} from '../shared/responsive-layout.js';

function layoutStyle(
  definition: ContinuumNodeProps['definition'],
  isCompact: boolean
): CSSProperties {
  const layout = readNodeProp<string>(definition, 'layout') ?? 'vertical';
  const columns = nodeNumberProp(definition, 'columns', 2);
  const minItemWidth = nodeNumberProp(
    definition,
    'minItemWidth',
    layout === 'horizontal' ? 180 : 200
  );

  if (isCompact) {
    return {
      display: 'grid',
      gap: space.md,
    };
  }

  if (layout === 'horizontal') {
    return {
      display: 'grid',
      gridTemplateColumns: responsiveGridColumns(columns, minItemWidth, space.md),
      gap: space.md,
      alignItems: 'start',
    };
  }

  if (layout === 'grid') {
    return {
      display: 'grid',
      gridTemplateColumns: responsiveGridColumns(columns, minItemWidth, space.md),
      gap: space.md,
      alignItems: 'start',
    };
  }

  return {
    display: 'grid',
    gap: space.md,
  };
}

export function GroupSection(props: ContinuumNodeProps) {
  const isCompact = useCompactViewport();

  return (
    <ContainerShell
      title={nodeLabel(props.definition)}
      description={nodeDescription(props.definition)}
      nodeId={props.nodeId}
      itemIndex={props.itemIndex as number | undefined}
      canRemove={props.canRemove as boolean | undefined}
      onRemove={props.onRemove as (() => void) | undefined}
      layoutStyle={layoutStyle(props.definition, isCompact)}
    >
      {props.children}
    </ContainerShell>
  );
}
