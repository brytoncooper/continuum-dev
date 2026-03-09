import type { NodeValue } from '@continuum-dev/contract';
import type { ContinuumNodeProps } from '@continuum-dev/react';
import { FieldFrame, useInputLikeStyle } from '../shared/field-frame.js';
import {
  nodeDescription,
  nodeLabel,
  nodeOptions,
  readNodeProp,
} from '../shared/node.js';

export function SelectInput({
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
      <select
        value={selected}
        style={useInputLikeStyle({ cursor: 'pointer', paddingRight: 40 })}
        onChange={(event) =>
          onChange({ value: event.target.value, isDirty: true } as NodeValue)
        }
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
