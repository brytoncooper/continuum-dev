import type { CSSProperties } from 'react';
import type { ContinuumNodeProps } from '@continuum/react';
import { space } from '../../tokens.js';
import { ContainerShell } from '../shared/container-shell.js';
import { nodeDescription, nodeLabel, readNodeProp } from '../shared/node.js';

function layoutStyle(definition: ContinuumNodeProps['definition']): CSSProperties {
  const layout = readNodeProp<string>(definition, 'layout') ?? 'vertical';
  const columns = readNodeProp<number>(definition, 'columns') ?? 2;

  if (layout === 'horizontal') {
    return {
      display: 'flex',
      flexWrap: 'wrap',
      gap: space.lg,
      alignItems: 'start',
    };
  }

  if (layout === 'grid') {
    return {
      display: 'grid',
      gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
      gap: space.lg,
      alignItems: 'start',
    };
  }

  return {
    display: 'grid',
    gap: space.lg,
  };
}

export function GroupSection(props: ContinuumNodeProps) {
  return (
    <ContainerShell
      title={nodeLabel(props.definition)}
      description={nodeDescription(props.definition)}
      nodeId={props.nodeId}
      itemIndex={props.itemIndex as number | undefined}
      canRemove={props.canRemove as boolean | undefined}
      onRemove={props.onRemove as (() => void) | undefined}
      layoutStyle={layoutStyle(props.definition)}
    >
      {props.children}
    </ContainerShell>
  );
}
