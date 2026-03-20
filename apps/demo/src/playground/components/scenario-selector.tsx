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
  coreScenario,
  advancedScenarios,
  activeScenarioId,
  onSelect,
}: {
  coreScenario: PlaygroundScenario;
  advancedScenarios: PlaygroundScenario[];
  activeScenarioId: string;
  onSelect: (scenarioId: string) => void;
}) {
  const { isMobile } = useResponsiveState();
  const isCoreActive = coreScenario.id === activeScenarioId;

  return (
    <div style={{ ...wrapStyle, padding: isMobile ? space.xl : wrapStyle.padding }}>
      <div style={introStyle}>
        Start with the basic example, or try other scenarios.
      </div>
      <div style={listStyle}>
        <button
          type="button"
          style={buttonStyle(isCoreActive)}
          onClick={() => onSelect(coreScenario.id)}
        >
          {coreScenario.selectorLabel}
        </button>
      </div>
      {advancedScenarios.length ? (
        <details>
          <summary style={queuedStyle}>Try advanced scenarios</summary>
          <div style={{ ...listStyle, marginTop: space.sm }}>
            {advancedScenarios.map((scenario) => (
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
        </details>
      ) : null}
    </div>
  );
}
