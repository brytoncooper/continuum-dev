import type { CSSProperties } from 'react';
import { useContinuumSuggestions } from '@continuum-dev/react';
import { color, radius, space, type } from '../tokens.js';

const containerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: space.md,
  flexWrap: 'wrap',
  padding: space.lg,
  borderRadius: radius.md,
  border: `1px solid ${color.borderStrong}`,
  background: color.surface,
};

const copyStyle: CSSProperties = {
  ...type.body,
  color: color.text,
};

const actionsStyle: CSSProperties = {
  display: 'flex',
  gap: space.sm,
  flexWrap: 'wrap',
};

const buttonStyle: CSSProperties = {
  ...type.small,
  color: color.text,
  padding: `${space.sm}px ${space.md}px`,
  borderRadius: radius.pill,
  border: `1px solid ${color.border}`,
  background: color.surfaceMuted,
  cursor: 'pointer',
};

export function StarterKitSuggestionsBar({
  label = 'Suggested updates are available.',
}: {
  label?: string;
}) {
  const { hasSuggestions, acceptAll, rejectAll } = useContinuumSuggestions();

  if (!hasSuggestions) {
    return null;
  }

  return (
    <div style={containerStyle}>
      <div style={copyStyle}>{label}</div>
      <div style={actionsStyle}>
        <button type="button" style={buttonStyle} onClick={acceptAll}>
          Accept all
        </button>
        <button type="button" style={buttonStyle} onClick={rejectAll}>
          Reject all
        </button>
      </div>
    </div>
  );
}
