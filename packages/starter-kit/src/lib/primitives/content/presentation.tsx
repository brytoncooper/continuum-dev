import type { ContinuumNodeProps } from '@continuum-dev/react';
import { color, space, type } from '../../tokens.js';
import { streamedNodeMotionStyle } from '../shared/motion.js';
import { readNodeProp } from '../shared/node.js';

export function Presentation({ definition }: ContinuumNodeProps) {
  const content = readNodeProp<string>(definition, 'content') ?? '';

  return (
    <div
      data-continuum-animated="presentation"
      data-continuum-node-shell="true"
      data-continuum-node-id={definition.id}
      style={{
        display: 'grid',
        gap: space.sm,
        padding: `${space.sm}px 0`,
        ...streamedNodeMotionStyle(definition.id, 'shell'),
      }}
    >
      <div
        data-continuum-animated-child="content"
        style={{
          ...type.body,
          color: color.text,
          ...streamedNodeMotionStyle(definition.id, 'content'),
        }}
      >
        {content}
      </div>
    </div>
  );
}
