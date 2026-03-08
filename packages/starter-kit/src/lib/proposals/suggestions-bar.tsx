import type { CSSProperties } from 'react';
import { useContinuumSuggestions } from '@continuum-dev/react';
import { color, radius, space, type } from '../tokens.js';
import { starterKitDefaultStyles, useStarterKitStyle } from '../style-config.js';

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

export function StarterKitSuggestionsBar({
  label = 'Suggested updates are available.',
}: {
  label?: string;
}) {
  const { hasSuggestions, acceptAll, rejectAll } = useContinuumSuggestions();
  const buttonStyle = useStarterKitStyle('suggestionsActionButton', starterKitDefaultStyles.suggestionsActionButton);

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
