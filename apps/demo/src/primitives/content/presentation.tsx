import type { ContinuumNodeProps } from '@continuum/react';
import { color, space, type } from '../../ui/tokens';
import { readNodeProp } from '../shared/node';

export function Presentation({ definition }: ContinuumNodeProps) {
  const content = readNodeProp<string>(definition, 'content') ?? '';

  return (
    <div
      style={{
        display: 'grid',
        gap: space.sm,
        padding: `${space.sm}px 0`,
      }}
    >
      <div style={{ ...type.body, color: color.text }}>{content}</div>
    </div>
  );
}
