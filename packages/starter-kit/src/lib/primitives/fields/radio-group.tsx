import type { NodeValue } from '@continuum/contract';
import type { ContinuumNodeProps } from '@continuum/react';
import type { CSSProperties } from 'react';
import { color, radius, space, type } from '../../tokens.js';
import { FieldFrame } from '../shared/field-frame.js';
import { nodeDescription, nodeLabel, nodeOptions } from '../shared/node.js';

const optionStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: space.md,
  padding: `${space.sm}px ${space.md}px`,
  borderRadius: radius.md,
  border: `1px solid ${color.borderSoft}`,
  background: color.surfaceMuted,
};

export function RadioGroupInput({ value, onChange, definition }: ContinuumNodeProps) {
  const selected = (value as NodeValue<string> | undefined)?.value ?? '';
  const options = nodeOptions(definition);

  return (
    <FieldFrame label={nodeLabel(definition)} description={nodeDescription(definition)}>
      <div style={{ display: 'grid', gap: space.sm }}>
        {options.map((option) => (
          <label key={option.value} style={optionStyle}>
            <input
              type="radio"
              name={definition.id}
              checked={selected === option.value}
              onChange={() => onChange({ value: option.value, isDirty: true } as NodeValue)}
            />
            <span style={{ ...type.body, color: color.text }}>{option.label}</span>
          </label>
        ))}
      </div>
    </FieldFrame>
  );
}
