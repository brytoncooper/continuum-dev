import type { CSSProperties, ReactNode } from 'react';
import { color, space, type } from '../../tokens.js';
import { starterKitDefaultStyles, useStarterKitStyle } from '../../style-config.js';

const wrapStyle: CSSProperties = {
  display: 'grid',
  gap: space.sm,
  minWidth: 0,
  boxSizing: 'border-box',
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

export const controlStyle: CSSProperties = starterKitDefaultStyles.fieldControl;

export function inputLikeStyle(overrides?: CSSProperties): CSSProperties {
  return {
    ...controlStyle,
    ...overrides,
  };
}

export function useInputLikeStyle(overrides?: CSSProperties): CSSProperties {
  return useStarterKitStyle('fieldControl', inputLikeStyle(overrides));
}

export function FieldFrame({
  label,
  description,
  children,
}: {
  label?: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <label style={wrapStyle}>
      {label || description ? (
        <div style={labelRowStyle}>
          {label ? <span style={labelStyle}>{label}</span> : null}
          {description ? <span style={descriptionStyle}>{description}</span> : null}
        </div>
      ) : null}
      {children}
    </label>
  );
}
