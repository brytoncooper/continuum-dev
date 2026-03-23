import type { NodeValue } from '@continuum-dev/contract';
import type { ContinuumNodeProps } from '@continuum-dev/react';
import { FieldFrame, useInputLikeStyle } from '../shared/field-frame.js';
import {
  compactFieldControlStyle,
  useCompactViewport,
} from '../shared/responsive-layout.js';
import {
  nodeDescription,
  nodeLabel,
  nodePlaceholder,
  readNodeProp,
  scalarFieldDisplayString,
} from '../shared/node.js';

export function TextInput({
  value,
  onChange,
  definition,
  nodeId,
  hasSuggestion,
  suggestionValue,
}: ContinuumNodeProps) {
  const nodeValue = value as NodeValue<string | number> | undefined;
  const isCompact = useCompactViewport();
  const label = nodeLabel(definition);
  const dataType = readNodeProp<string>(definition, 'dataType') ?? 'string';
  const defaultValue = readNodeProp<string | number>(
    definition,
    'defaultValue'
  );
  const rawValue = nodeValue?.value ?? defaultValue;
  const displayValue = scalarFieldDisplayString(rawValue, dataType);

  return (
    <FieldFrame
      nodeId={nodeId}
      label={label}
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
      <input
        type={dataType === 'number' ? 'number' : 'text'}
        value={displayValue}
        data-continuum-control="true"
        data-continuum-node-id={nodeId}
        placeholder={nodePlaceholder(definition) ?? 'Enter value'}
        readOnly={Boolean(readNodeProp<boolean>(definition, 'readOnly'))}
        style={{
          ...useInputLikeStyle(),
          ...compactFieldControlStyle(isCompact),
        }}
        onChange={(event) =>
          onChange({
            value:
              dataType === 'number'
                ? Number(event.target.value)
                : event.target.value,
            isDirty: true,
          } as NodeValue)
        }
      />
    </FieldFrame>
  );
}
