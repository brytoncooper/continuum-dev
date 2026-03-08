import type { NodeValue } from '@continuum-dev/contract';
import type { ContinuumNodeProps } from '@continuum-dev/react';
import { FieldFrame, useInputLikeStyle } from '../shared/field-frame.js';
import {
  nodeDescription,
  nodeLabel,
  nodePlaceholder,
  readNodeProp,
} from '../shared/node.js';

export function TextInput({ value, onChange, definition }: ContinuumNodeProps) {
  const label = nodeLabel(definition);
  const dataType = readNodeProp<string>(definition, 'dataType') ?? 'string';
  const defaultValue = readNodeProp<string | number>(definition, 'defaultValue');
  const rawValue =
    (value as NodeValue<string | number> | undefined)?.value ?? defaultValue;
  const displayValue =
    dataType === 'number'
      ? typeof rawValue === 'number'
        ? String(rawValue)
        : ''
      : typeof rawValue === 'string'
      ? rawValue
      : '';

  return (
    <FieldFrame
      label={label}
      description={nodeDescription(definition)}
    >
      <input
        type={dataType === 'number' ? 'number' : 'text'}
        value={displayValue}
        placeholder={
          nodePlaceholder(definition) ?? 'Enter value'
        }
        readOnly={Boolean(readNodeProp<boolean>(definition, 'readOnly'))}
        style={useInputLikeStyle()}
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
