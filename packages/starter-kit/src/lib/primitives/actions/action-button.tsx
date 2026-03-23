import type { ContinuumNodeProps } from '@continuum-dev/react';
import { useContinuumAction } from '@continuum-dev/react';
import { color, space, type } from '../../tokens.js';
import {
  starterKitDefaultStyles,
  useStarterKitStyle,
} from '../../style-config.js';
import { streamedNodeMotionStyle } from '../shared/motion.js';
import { nodeDescription, nodeLabel, readNodeProp } from '../shared/node.js';

export function ActionButton({ definition }: ContinuumNodeProps) {
  const intentId = readNodeProp<string>(definition, 'intentId') ?? '';
  const label = nodeLabel(definition) ?? 'Run action';
  const { dispatch, isDispatching, lastResult } = useContinuumAction(intentId);

  const buttonStyle = useStarterKitStyle(
    'actionButton',
    starterKitDefaultStyles.actionButton
  );

  return (
    <div
      data-continuum-animated="action"
      data-continuum-node-shell="true"
      data-continuum-node-id={definition.id}
      style={{
        display: 'grid',
        gap: space.sm,
        alignContent: 'start',
        justifyItems: 'stretch',
        width: '100%',
        flex: '1 0 100%',
        ...streamedNodeMotionStyle(definition.id, 'shell'),
      }}
    >
      <div
        data-continuum-animated-child="control"
        style={streamedNodeMotionStyle(definition.id, 'content')}
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
      </div>
      {nodeDescription(definition) ? (
        <div
          data-continuum-animated-child="meta"
          style={{
            ...type.small,
            color: color.textMuted,
            ...streamedNodeMotionStyle(definition.id, 'content'),
          }}
        >
          {nodeDescription(definition)}
        </div>
      ) : null}
      {lastResult ? (
        <div
          data-continuum-animated-child="meta"
          style={{
            ...type.small,
            color: color.textMuted,
            ...streamedNodeMotionStyle(definition.id, 'content'),
          }}
        >
          {lastResult.success ? 'Action completed' : 'Action failed'}
        </div>
      ) : null}
    </div>
  );
}
