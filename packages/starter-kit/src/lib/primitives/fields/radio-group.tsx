import type { NodeValue } from '@continuum-dev/contract';
import type { ContinuumNodeProps } from '@continuum-dev/react';
import type { CSSProperties } from 'react';
import { color, radius, space, type } from '../../tokens.js';
import { FieldFrame } from '../shared/field-frame.js';
import {
  nodeDescription,
  nodeLabel,
  nodeOptions,
  readNodeProp,
} from '../shared/node.js';

const optionStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: space.md,
  padding: `${space.sm}px ${space.md}px`,
  borderRadius: radius.md,
  border: `1px solid ${color.borderSoft}`,
  background: color.surfaceMuted,
};

export function RadioGroupInput({
  value,
  onChange,
  definition,
  nodeId,
  hasSuggestion,
  suggestionValue,
}: ContinuumNodeProps) {
  const nodeValue = value as NodeValue<string> | undefined;
  const selected =
    nodeValue?.value ??
    readNodeProp<string>(definition, 'defaultValue') ??
    '';
  const options = nodeOptions(definition);

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
        {options.map((option) => (
          <label key={option.value} style={optionStyle}>
            <input
              type="radio"
              name={definition.id}
              checked={selected === option.value}
              data-continuum-control="true"
              data-continuum-node-id={nodeId}
              onChange={() =>
                onChange({ value: option.value, isDirty: true } as NodeValue)
              }
            />
            <span style={{ ...type.body, color: color.text }}>
              {option.label}
            </span>
          </label>
        ))}
      </div>
    </FieldFrame>
  );
}
