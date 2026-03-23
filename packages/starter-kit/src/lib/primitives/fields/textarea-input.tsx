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
} from '../shared/node.js';

export function TextareaInput({
  value,
  onChange,
  definition,
  nodeId,
  hasSuggestion,
  suggestionValue,
}: ContinuumNodeProps) {
  const nodeValue = value as NodeValue<string> | undefined;
  const isCompact = useCompactViewport();
  const label = nodeLabel(definition);
  const text =
    nodeValue?.value ?? readNodeProp<string>(definition, 'defaultValue') ?? '';

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
      <textarea
        value={text}
        data-continuum-control="true"
        data-continuum-node-id={nodeId}
        placeholder={nodePlaceholder(definition) ?? 'Enter text'}
        style={{
          ...useInputLikeStyle({
            minHeight: 120,
            height: 120,
            resize: 'vertical',
          }),
          ...compactFieldControlStyle(isCompact),
          minHeight: isCompact ? 144 : 120,
          height: isCompact ? 144 : 120,
        }}
        onChange={(event) =>
          onChange({ value: event.target.value, isDirty: true } as NodeValue)
        }
      />
    </FieldFrame>
  );
}
