import type { CSSProperties } from 'react';
import type { PlaygroundScenario } from '../types';
import { color, radius, space, type } from '../../ui/tokens';
import { useResponsiveState } from '../../ui/responsive';

const wrapStyle: CSSProperties = {
  display: 'grid',
  gap: space.md,
  padding: space.xxl,
  borderRadius: radius.lg,
  border: `1px solid ${color.border}`,
  background: color.surface,
};

const introStyle: CSSProperties = {
  ...type.body,
  color: color.textMuted,
  maxWidth: 760,
};

const listStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: space.sm,
};

const queuedStyle: CSSProperties = {
  ...type.small,
  color: color.textMuted,
};

const buttonStyle = (active: boolean): CSSProperties => ({
  ...type.small,
  color: color.text,
  padding: `${space.sm}px ${space.md}px`,
  borderRadius: radius.pill,
  border: `1px solid ${active ? color.accentStrong : color.border}`,
  background: active ? color.accentSoft : color.surface,
  cursor: 'pointer',
});

export function ScenarioSelector({
  scenarios,
  activeScenarioId,
  onSelect,
  queuedScenarios,
}: {
  scenarios: PlaygroundScenario[];
  activeScenarioId: string;
  onSelect: (scenarioId: string) => void;
  queuedScenarios?: string[];
}) {
  const { isMobile } = useResponsiveState();

  return (
    <div style={{ ...wrapStyle, padding: isMobile ? space.xl : wrapStyle.padding }}>
      <div style={introStyle}>
        Pick a deterministic problem at the top, then advance its steps to compare the same update
        with and without Continuum reconciliation.
      </div>
      <div style={listStyle}>
        {scenarios.map((scenario) => (
          <button
            key={scenario.id}
            type="button"
            style={buttonStyle(scenario.id === activeScenarioId)}
            onClick={() => onSelect(scenario.id)}
          >
            {scenario.selectorLabel}
          </button>
        ))}
      </div>
      {queuedScenarios?.length ? (
        <div style={queuedStyle}>{`Queued after these: ${queuedScenarios.join(', ')}`}</div>
      ) : null}
    </div>
  );
}
