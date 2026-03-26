import type { ContinuumNodeProps } from '@continuum-dev/react';
import { space } from '../../tokens.js';
import { ContainerShell } from '../shared/container-shell.js';
import { nodeDescription, nodeLabel, nodeNumberProp } from '../shared/node.js';
import {
  responsiveGridColumns,
  useCompactViewport,
} from '../shared/responsive-layout.js';

export function GridSection(props: ContinuumNodeProps) {
  const isCompact = useCompactViewport();
  const columns = nodeNumberProp(props.definition, 'columns', 2);
  const minItemWidth = nodeNumberProp(props.definition, 'minItemWidth', 180);

  return (
    <ContainerShell
      title={nodeLabel(props.definition)}
      description={nodeDescription(props.definition)}
      nodeId={props.nodeId}
      itemIndex={props.itemIndex as number | undefined}
      canRemove={props.canRemove as boolean | undefined}
      onRemove={props.onRemove as (() => void) | undefined}
      layoutStyle={{
        display: 'grid',
        gridTemplateColumns: isCompact
          ? 'minmax(0, 1fr)'
          : responsiveGridColumns(columns, minItemWidth, space.md),
        gap: space.md,
        alignItems: 'start',
      }}
    >
      {props.children}
    </ContainerShell>
  );
}
