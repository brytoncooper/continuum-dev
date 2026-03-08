import type { ContinuumNodeProps } from '@continuum/react';
import { space } from '../../tokens.js';
import { ContainerShell } from '../shared/container-shell.js';
import { nodeDescription, nodeLabel } from '../shared/node.js';

export function RowSection(props: ContinuumNodeProps) {
  const isCollectionItem = typeof props.itemIndex === 'number';

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
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'start',
        gap: space.lg,
      }}
    >
      {props.children}
    </ContainerShell>
  );
}
