import type { NodeValue } from '@continuum/contract';
import type { ContinuumNodeProps } from '@continuum/react';
import { color, space, type } from '../../ui/tokens';
import { FieldFrame } from '../shared/field-frame';
import { nodeDescription, nodeLabel, nodeNumberProp } from '../shared/node';

export function SliderInput({ value, onChange, definition }: ContinuumNodeProps) {
  const min = nodeNumberProp(definition, 'min', 0);
  const max = nodeNumberProp(definition, 'max', 100);
  const fallback = Math.round((min + max) / 2);
  const numericValue =
    typeof (value as NodeValue<number> | undefined)?.value === 'number'
      ? (value as NodeValue<number>).value
      : fallback;

  return (
    <FieldFrame label={nodeLabel(definition)} description={nodeDescription(definition)}>
      <div style={{ display: 'grid', gap: space.sm }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', ...type.small, color: color.textMuted }}>
          <span>{min}</span>
          <span style={{ color: color.text }}>{numericValue}</span>
          <span>{max}</span>
        </div>
        <input
          type="range"
          min={min}
          max={max}
          value={numericValue}
          style={{ width: '100%', accentColor: color.accent }}
          onChange={(event) => onChange({ value: Number(event.target.value), isDirty: true } as NodeValue)}
        />
      </div>
    </FieldFrame>
  );
}
