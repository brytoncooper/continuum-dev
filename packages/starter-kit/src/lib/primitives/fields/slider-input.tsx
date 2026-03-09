import type { NodeValue } from '@continuum-dev/contract';
import type { ContinuumNodeProps } from '@continuum-dev/react';
import { color, space, type } from '../../tokens.js';
import { starterKitDefaultStyles, useStarterKitStyle } from '../../style-config.js';
import { FieldFrame } from '../shared/field-frame.js';
import {
  nodeDescription,
  nodeLabel,
  nodeNumberProp,
  readNodeProp,
} from '../shared/node.js';

export function SliderInput({
  value,
  onChange,
  definition,
  nodeId,
  hasSuggestion,
  suggestionValue,
}: ContinuumNodeProps) {
  const nodeValue = value as NodeValue<number> | undefined;
  const min = nodeNumberProp(definition, 'min', 0);
  const max = nodeNumberProp(definition, 'max', 100);
  const fallback = Math.round((min + max) / 2);
  const defaultValue = readNodeProp<number>(definition, 'defaultValue');
  const numericValue =
    typeof nodeValue?.value === 'number'
      ? nodeValue.value
      : typeof defaultValue === 'number'
      ? defaultValue
      : fallback;
  const sliderStyle = useStarterKitStyle('sliderInput', starterKitDefaultStyles.sliderInput);

  return (
    <FieldFrame
      nodeId={nodeId}
      label={nodeLabel(definition)}
      description={nodeDescription(definition)}
      hasSuggestion={Boolean(hasSuggestion)}
      suggestionValue={suggestionValue}
      currentValue={nodeValue?.value}
      onAcceptSuggestion={() => {
        if (suggestionValue === undefined) {
          return;
        }
        onChange({
          ...(nodeValue ?? {}),
          value: suggestionValue,
          suggestion: undefined,
          isDirty: true,
        } as NodeValue);
      }}
      onRejectSuggestion={() => {
        if (!nodeValue) {
          return;
        }
        onChange({
          ...nodeValue,
          suggestion: undefined,
        } as NodeValue);
      }}
    >
      <div style={{ display: 'grid', gap: space.sm }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            ...type.small,
            color: color.textMuted,
          }}
        >
          <span>{min}</span>
          <span style={{ color: color.text }}>{numericValue}</span>
          <span>{max}</span>
        </div>
        <input
          type="range"
          min={min}
          max={max}
          value={numericValue}
          style={sliderStyle}
          onChange={(event) =>
            onChange({
              value: Number(event.target.value),
              isDirty: true,
            } as NodeValue)
          }
        />
      </div>
    </FieldFrame>
  );
}
