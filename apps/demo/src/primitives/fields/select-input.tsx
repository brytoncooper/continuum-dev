import type { NodeValue } from '@continuum/contract';
import type { ContinuumNodeProps } from '@continuum/react';
import { FieldFrame, inputLikeStyle } from '../shared/field-frame';
import { nodeDescription, nodeLabel, nodeOptions } from '../shared/node';

export function SelectInput({ value, onChange, definition }: ContinuumNodeProps) {
  const selected = (value as NodeValue<string> | undefined)?.value ?? '';
  const options = nodeOptions(definition);

  return (
    <FieldFrame label={nodeLabel(definition)} description={nodeDescription(definition)}>
      <select
        value={selected}
        style={inputLikeStyle({ cursor: 'pointer', paddingRight: 40 })}
        onChange={(event) => onChange({ value: event.target.value, isDirty: true } as NodeValue)}
      >
        <option value="">Select one</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldFrame>
  );
}
