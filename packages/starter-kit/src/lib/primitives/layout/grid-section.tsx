import type { ContinuumNodeProps } from '@continuum-dev/react';
import { space } from '../../tokens.js';
import { ContainerShell } from '../shared/container-shell.js';
import { nodeDescription, nodeLabel, readNodeProp } from '../shared/node.js';
import { responsiveGridColumns } from '../shared/responsive-layout.js';

export function GridSection(props: ContinuumNodeProps) {
  const columns = readNodeProp<number>(props.definition, 'columns') ?? 2;

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
        gridTemplateColumns: responsiveGridColumns(columns),
        gap: space.lg,
        alignItems: 'start',
      }}
    >
      {props.children}
    </ContainerShell>
  );
}
