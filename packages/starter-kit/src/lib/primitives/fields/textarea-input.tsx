import type { NodeValue } from '@continuum/contract';
import type { ContinuumNodeProps } from '@continuum/react';
import { FieldFrame, inputLikeStyle } from '../shared/field-frame.js';
import { nodeDescription, nodeLabel, nodePlaceholder } from '../shared/node.js';

export function TextareaInput({ value, onChange, definition }: ContinuumNodeProps) {
  const text = (value as NodeValue<string> | undefined)?.value ?? '';

  return (
    <FieldFrame label={nodeLabel(definition)} description={nodeDescription(definition)}>
      <textarea
        value={text}
        placeholder={nodePlaceholder(definition) ?? `Enter ${nodeLabel(definition).toLowerCase()}`}
        style={inputLikeStyle({ minHeight: 120, height: 120, resize: 'vertical' })}
        onChange={(event) => onChange({ value: event.target.value, isDirty: true } as NodeValue)}
      />
    </FieldFrame>
  );
}
