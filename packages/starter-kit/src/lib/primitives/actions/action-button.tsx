import type { ContinuumNodeProps } from '@continuum-dev/react';
import { useContinuumAction } from '@continuum-dev/react';
import { color, space, type } from '../../tokens.js';
import { starterKitDefaultStyles, useStarterKitStyle } from '../../style-config.js';
import { nodeDescription, nodeLabel, readNodeProp } from '../shared/node.js';

export function ActionButton({ definition }: ContinuumNodeProps) {
  const intentId = readNodeProp<string>(definition, 'intentId') ?? '';
  const label = nodeLabel(definition) ?? 'Run action';
  const { dispatch, isDispatching, lastResult } = useContinuumAction(intentId);

  const buttonStyle = useStarterKitStyle('actionButton', starterKitDefaultStyles.actionButton);

  return (
    <div
      style={{
        display: 'grid',
        gap: space.sm,
        alignContent: 'start',
        justifyItems: 'stretch',
        width: '100%',
        flex: '1 0 100%',
      }}
    >
      <button
        type="button"
        style={{ ...buttonStyle, width: '100%', justifySelf: 'stretch' }}
        onClick={() => {
          void dispatch(definition.id);
        }}
      >
        {isDispatching ? 'Working...' : label}
      </button>
      {nodeDescription(definition) ? (
        <div
          style={{ ...type.small, color: color.textMuted }}
        >
          {nodeDescription(definition)}
        </div>
      ) : null}
      {lastResult ? (
        <div
          style={{ ...type.small, color: color.textMuted }}
        >
          {lastResult.success ? 'Action completed' : 'Action failed'}
        </div>
      ) : null}
    </div>
  );
}
