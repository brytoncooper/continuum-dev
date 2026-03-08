import type { NodeValue } from '@continuum-dev/contract';
import type { ContinuumNodeProps } from '@continuum-dev/react';
import { FieldFrame, useInputLikeStyle } from '../shared/field-frame.js';
import { nodeDescription, nodeLabel, readNodeProp } from '../shared/node.js';

export function DateInput({ value, onChange, definition }: ContinuumNodeProps) {
  const dateValue =
    (value as NodeValue<string> | undefined)?.value ??
    readNodeProp<string>(definition, 'defaultValue') ??
    '';

  return (
    <FieldFrame
      label={nodeLabel(definition)}
      description={nodeDescription(definition)}
    >
      <input
        type="date"
        value={dateValue}
        style={useInputLikeStyle()}
        onChange={(event) =>
          onChange({ value: event.target.value, isDirty: true } as NodeValue)
        }
      />
    </FieldFrame>
  );
}
