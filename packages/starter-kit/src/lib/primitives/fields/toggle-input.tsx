import type { NodeValue } from '@continuum-dev/contract';
import type { ContinuumNodeProps } from '@continuum-dev/react';
import type { CSSProperties } from 'react';
import { color, control, radius, space, type } from '../../tokens.js';
import { StarterKitFieldProposal } from '../../proposals/field-proposal.js';
import { nodeDescription, nodeLabel, readNodeProp } from '../shared/node.js';

const wrapStyle: CSSProperties = {
  display: 'grid',
  gap: space.sm,
  minWidth: 0,
};

const controlWrapStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: space.md,
  minHeight: control.height,
};

const trackStyle = (checked: boolean): CSSProperties => ({
  position: 'relative',
  width: 48,
  height: 28,
  borderRadius: radius.pill,
  background: checked ? color.accent : color.surfaceInset,
  border: `1px solid ${checked ? color.borderStrong : color.border}`,
  flexShrink: 0,
});

const thumbStyle = (checked: boolean): CSSProperties => ({
  position: 'absolute',
  top: 3,
  left: checked ? 23 : 3,
  width: 20,
  height: 20,
  borderRadius: radius.pill,
  background: color.surface,
  border: `1px solid ${checked ? color.borderStrong : color.border}`,
});

export function ToggleInput({
  value,
  onChange,
  definition,
  nodeId,
  hasSuggestion,
  suggestionValue,
}: ContinuumNodeProps) {
  const nodeValue = value as NodeValue<boolean> | undefined;
  const label = nodeLabel(definition);
  const checked = Boolean(
    nodeValue?.value ??
      readNodeProp<boolean>(definition, 'defaultValue')
  );

  return (
    <div style={wrapStyle}>
      <label style={controlWrapStyle}>
        <span style={trackStyle(checked)}>
          <span style={thumbStyle(checked)} />
          <input
            type="checkbox"
            checked={checked}
            style={{
              opacity: 0,
              position: 'absolute',
              inset: 0,
              cursor: 'pointer',
            }}
            onChange={(event) =>
              onChange({
                value: event.target.checked,
                isDirty: true,
              } as NodeValue)
            }
          />
        </span>
        <span style={{ display: 'grid', gap: space.xs }}>
          {label ? <span style={{ ...type.section, color: color.text }}>{label}</span> : null}
          {nodeDescription(definition) ? (
            <span style={{ ...type.small, color: color.textMuted }}>
              {nodeDescription(definition)}
            </span>
          ) : null}
        </span>
      </label>
      {nodeId ? (
        <StarterKitFieldProposal
          title={label ?? 'Field suggestion'}
          hasSuggestion={Boolean(hasSuggestion)}
          currentValue={nodeValue?.value}
          suggestionValue={suggestionValue}
          currentLabel="Current value"
          nextLabel="AI suggestion"
          onAccept={() => {
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
          onReject={() => {
            if (!nodeValue) {
              return;
            }
            onChange({
              ...nodeValue,
              suggestion: undefined,
            } as NodeValue);
          }}
        />
      ) : null}
    </div>
  );
}
