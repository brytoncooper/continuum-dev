import type { ContinuumNodeProps } from '@continuum/react';
import { color, radius, space, type } from '../../tokens.js';

export function UnknownNode({ definition }: ContinuumNodeProps) {
  return (
    <div
      style={{
        padding: space.lg,
        borderRadius: radius.md,
        border: `1px dashed ${color.border}`,
        background: color.surfaceMuted,
        ...type.small,
        color: color.textMuted,
      }}
    >
      {`No starter-kit primitive mapped for "${definition.type}"`}
    </div>
  );
}
