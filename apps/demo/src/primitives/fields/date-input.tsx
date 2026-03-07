import type { NodeValue } from '@continuum/contract';
import type { ContinuumNodeProps } from '@continuum/react';
import { FieldFrame, inputLikeStyle } from '../shared/field-frame';
import { nodeDescription, nodeLabel } from '../shared/node';

export function DateInput({ value, onChange, definition }: ContinuumNodeProps) {
  const dateValue = (value as NodeValue<string> | undefined)?.value ?? '';

  return (
    <FieldFrame label={nodeLabel(definition)} description={nodeDescription(definition)}>
      <input
        type="date"
        value={dateValue}
        style={inputLikeStyle()}
        onChange={(event) => onChange({ value: event.target.value, isDirty: true } as NodeValue)}
      />
    </FieldFrame>
  );
}
