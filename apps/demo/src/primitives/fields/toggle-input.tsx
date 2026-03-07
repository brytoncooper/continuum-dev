import type { NodeValue } from '@continuum/contract';
import type { ContinuumNodeProps } from '@continuum/react';
import type { CSSProperties } from 'react';
import { color, control, radius, space, type } from '../../ui/tokens';
import { nodeDescription, nodeLabel } from '../shared/node';

const wrapStyle: CSSProperties = {
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

export function ToggleInput({ value, onChange, definition }: ContinuumNodeProps) {
  const checked = Boolean((value as NodeValue<boolean> | undefined)?.value);

  return (
    <label style={wrapStyle}>
      <span style={trackStyle(checked)}>
        <span style={thumbStyle(checked)} />
        <input
          type="checkbox"
          checked={checked}
          style={{ opacity: 0, position: 'absolute', inset: 0, cursor: 'pointer' }}
          onChange={(event) => onChange({ value: event.target.checked, isDirty: true } as NodeValue)}
        />
      </span>
      <span style={{ display: 'grid', gap: space.xs }}>
        <span style={{ ...type.section, color: color.text }}>{nodeLabel(definition)}</span>
        {nodeDescription(definition) ? (
          <span style={{ ...type.small, color: color.textMuted }}>{nodeDescription(definition)}</span>
        ) : null}
      </span>
    </label>
  );
}
