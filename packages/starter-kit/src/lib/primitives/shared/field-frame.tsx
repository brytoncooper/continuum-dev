import type { CSSProperties, ReactNode } from 'react';
import { color, control, radius, space, type } from '../../tokens.js';

const wrapStyle: CSSProperties = {
  display: 'grid',
  gap: space.sm,
  minWidth: 0,
};

const labelRowStyle: CSSProperties = {
  display: 'grid',
  gap: space.xs,
};

const labelStyle: CSSProperties = {
  ...type.label,
  color: color.textSoft,
};

const descriptionStyle: CSSProperties = {
  ...type.small,
  color: color.textMuted,
};

export const controlStyle: CSSProperties = {
  width: '100%',
  minWidth: 0,
  height: control.height,
  padding: `${control.paddingY}px ${control.paddingX}px`,
  borderRadius: radius.md,
  border: `1px solid ${color.border}`,
  background: color.surface,
  color: color.text,
  outline: 'none',
};

export function inputLikeStyle(overrides?: CSSProperties): CSSProperties {
  return {
    ...controlStyle,
    ...type.body,
    ...overrides,
  };
}

export function FieldFrame({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <label style={wrapStyle}>
      <div style={labelRowStyle}>
        <span style={labelStyle}>{label}</span>
        {description ? <span style={descriptionStyle}>{description}</span> : null}
      </div>
      {children}
    </label>
  );
}
