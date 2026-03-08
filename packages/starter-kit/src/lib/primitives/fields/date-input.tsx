import type { NodeValue } from '@continuum-dev/contract';
import type { ContinuumNodeProps } from '@continuum-dev/react';
import { FieldFrame, inputLikeStyle } from '../shared/field-frame.js';
import { nodeDescription, nodeLabel } from '../shared/node.js';

export function DateInput({ value, onChange, definition }: ContinuumNodeProps) {
  const dateValue = (value as NodeValue<string> | undefined)?.value ?? '';

  return (
    <FieldFrame
      label={nodeLabel(definition)}
      description={nodeDescription(definition)}
    >
      <input
        type="date"
        value={dateValue}
        style={inputLikeStyle()}
        onChange={(event) =>
          onChange({ value: event.target.value, isDirty: true } as NodeValue)
        }
      />
    </FieldFrame>
  );
}
