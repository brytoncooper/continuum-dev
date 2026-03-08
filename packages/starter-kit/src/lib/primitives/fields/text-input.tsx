import type { NodeValue } from '@continuum/contract';
import type { ContinuumNodeProps } from '@continuum/react';
import { FieldFrame, inputLikeStyle } from '../shared/field-frame.js';
import { nodeDescription, nodeLabel, nodePlaceholder, readNodeProp } from '../shared/node.js';

export function TextInput({ value, onChange, definition }: ContinuumNodeProps) {
  const dataType = readNodeProp<string>(definition, 'dataType') ?? 'string';
  const rawValue = (value as NodeValue<string | number> | undefined)?.value;
  const displayValue =
    dataType === 'number'
      ? typeof rawValue === 'number'
        ? String(rawValue)
        : ''
      : typeof rawValue === 'string'
        ? rawValue
        : '';

  return (
    <FieldFrame label={nodeLabel(definition)} description={nodeDescription(definition)}>
      <input
        type={dataType === 'number' ? 'number' : 'text'}
        value={displayValue}
        placeholder={nodePlaceholder(definition) ?? `Enter ${nodeLabel(definition).toLowerCase()}`}
        readOnly={Boolean(readNodeProp<boolean>(definition, 'readOnly'))}
        style={inputLikeStyle()}
        onChange={(event) =>
          onChange({
            value: dataType === 'number' ? Number(event.target.value) : event.target.value,
            isDirty: true,
          } as NodeValue)
        }
      />
    </FieldFrame>
  );
}
