import type { NodeValue } from '@continuum-dev/contract';
import type { ContinuumNodeProps } from '@continuum-dev/react';
import type { CSSProperties } from 'react';
import { color, radius, space, type } from '../../tokens.js';
import { FieldFrame } from '../shared/field-frame.js';
import { useCompactViewport } from '../shared/responsive-layout.js';
import {
  nodeDescription,
  nodeLabel,
  nodeOptionKey,
  nodeOptions,
  readNodeProp,
} from '../shared/node.js';

const selectionMarkerStyle = (selected: boolean): CSSProperties => ({
  width: 18,
  height: 18,
  borderRadius: radius.pill,
  border: `1px solid ${selected ? color.borderStrong : color.border}`,
  background: selected ? color.accent : color.surface,
  boxShadow: selected ? `inset 0 0 0 4px ${color.surface}` : 'none',
  flexShrink: 0,
});

const optionStyle = (selected: boolean, isCompact: boolean): CSSProperties => ({
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  gap: isCompact ? space.md : space.sm,
  padding: `${isCompact ? space.md : space.sm}px ${space.md}px`,
  borderRadius: radius.md,
  border: `1px solid ${selected ? color.borderStrong : color.borderSoft}`,
  background: selected ? color.surface : color.surfaceMuted,
  boxShadow: selected ? '0 8px 22px rgba(17, 17, 17, 0.08)' : 'none',
  cursor: 'pointer',
  minWidth: 0,
});

export function RadioGroupInput({
  value,
  onChange,
  definition,
  nodeId,
  hasSuggestion,
  suggestionValue,
}: ContinuumNodeProps) {
  const nodeValue = value as NodeValue<string> | undefined;
  const isCompact = useCompactViewport();
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
        {options.map((option, index) => (
          <label
            key={nodeOptionKey(option, index)}
            style={optionStyle(selected === option.value, isCompact)}
          >
            <span aria-hidden="true" style={selectionMarkerStyle(selected === option.value)} />
            <input
              type="radio"
              name={nodeId}
              checked={selected === option.value}
              data-continuum-control="true"
              data-continuum-node-id={nodeId}
              style={{
                position: 'absolute',
                opacity: 0,
                pointerEvents: 'none',
                width: 1,
                height: 1,
              }}
              onChange={() =>
                onChange({ value: option.value, isDirty: true } as NodeValue)
              }
            />
            <span
              style={{
                ...type.body,
                color: color.text,
                fontWeight: selected === option.value ? 600 : 400,
              }}
            >
              {option.label}
            </span>
          </label>
        ))}
      </div>
    </FieldFrame>
  );
}
