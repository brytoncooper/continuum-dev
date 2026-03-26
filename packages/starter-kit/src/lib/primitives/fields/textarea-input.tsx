import type { NodeValue } from '@continuum-dev/contract';
import type { ContinuumNodeProps } from '@continuum-dev/react';
import { useEffect, useRef } from 'react';
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

function resizeTextarea(textarea: HTMLTextAreaElement, minHeight: number) {
  textarea.style.height = 'auto';
  textarea.style.height = `${Math.max(textarea.scrollHeight, minHeight)}px`;
}

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
  const minHeight = isCompact ? 104 : 88;
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!textareaRef.current) {
      return;
    }

    resizeTextarea(textareaRef.current, minHeight);
  }, [minHeight, text]);

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
        ref={textareaRef}
        value={text}
        data-continuum-control="true"
        data-continuum-node-id={nodeId}
        placeholder={nodePlaceholder(definition) ?? 'Enter text'}
        style={{
          ...useInputLikeStyle({
            minHeight,
            height: minHeight,
            resize: 'vertical',
            overflow: 'hidden',
          }),
          ...compactFieldControlStyle(isCompact),
          minHeight,
          height: minHeight,
        }}
        onInput={(event) => {
          resizeTextarea(event.currentTarget, minHeight);
        }}
        onChange={(event) =>
          onChange({ value: event.target.value, isDirty: true } as NodeValue)
        }
      />
    </FieldFrame>
  );
}
