import type { NodeValue } from '@continuum-dev/contract';
import type { ContinuumNodeProps } from '@continuum-dev/react';
import { FieldFrame, useInputLikeStyle } from '../shared/field-frame.js';
import {
  nodeDescription,
  nodeLabel,
  nodePlaceholder,
  readNodeProp,
} from '../shared/node.js';

export function TextareaInput({
  value,
  onChange,
  definition,
}: ContinuumNodeProps) {
  const label = nodeLabel(definition);
  const text =
    (value as NodeValue<string> | undefined)?.value ??
    readNodeProp<string>(definition, 'defaultValue') ??
    '';

  return (
    <FieldFrame
      label={label}
      description={nodeDescription(definition)}
    >
      <textarea
        value={text}
        placeholder={
          nodePlaceholder(definition) ?? 'Enter text'
        }
        style={useInputLikeStyle({
          minHeight: 120,
          height: 120,
          resize: 'vertical',
        })}
        onChange={(event) =>
          onChange({ value: event.target.value, isDirty: true } as NodeValue)
        }
      />
    </FieldFrame>
  );
}
