import type { ContinuumNodeProps } from '@continuum-dev/react';
import { useContinuumAction } from '@continuum-dev/react';
import { color, control, radius, space, type } from '../../tokens.js';
import { nodeDescription, nodeLabel, readNodeProp } from '../shared/node.js';

export function ActionButton({ definition }: ContinuumNodeProps) {
  const intentId = readNodeProp<string>(definition, 'intentId') ?? '';
  const { dispatch, isDispatching, lastResult } = useContinuumAction(intentId);

  return (
    <div
      style={{
        display: 'grid',
        gap: space.sm,
        alignContent: 'start',
        justifyItems: 'end',
        width: '100%',
        flex: '1 0 100%',
      }}
    >
      <button
        type="button"
        style={{
          height: control.height,
          padding: `0 ${space.lg}px`,
          borderRadius: radius.md,
          border: `1px solid ${color.borderStrong}`,
          background: color.accent,
          color: color.surface,
          cursor: 'pointer',
          justifySelf: 'end',
          ...type.body,
          fontWeight: 600,
        }}
        onClick={() => {
          void dispatch(definition.id);
        }}
      >
        {isDispatching ? 'Working…' : nodeLabel(definition)}
      </button>
      {nodeDescription(definition) ? (
        <div
          style={{ ...type.small, color: color.textMuted, textAlign: 'right' }}
        >
          {nodeDescription(definition)}
        </div>
      ) : null}
      {lastResult ? (
        <div
          style={{ ...type.small, color: color.textMuted, textAlign: 'right' }}
        >
          {lastResult.success ? 'Action completed' : 'Action failed'}
        </div>
      ) : null}
    </div>
  );
}
