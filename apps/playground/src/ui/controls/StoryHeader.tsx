import type { Scenario } from '../../scenarios/types';
import { color, radius, space, typeScale } from '../tokens';

type ProtocolMode = 'native' | 'a2ui';

interface StoryHeaderProps {
  scenarios: Scenario[];
  activeScenarioId: string;
  activeScenarioTitle: string;
  activeScenarioSubtitle: string;
  protocolMode: ProtocolMode;
  onScenarioSelect: (scenarioId: string) => void;
  onProtocolChange: (mode: ProtocolMode) => void;
}

export function StoryHeader({
  scenarios,
  activeScenarioId,
  activeScenarioTitle,
  activeScenarioSubtitle,
  protocolMode,
  onScenarioSelect,
  onProtocolChange,
}: StoryHeaderProps) {
  return (
    <div style={{ display: 'grid', gap: space.md }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: space.lg, alignItems: 'center' }}>
        <div style={{ display: 'grid', gap: space.xs }}>
          <h1 style={{ ...typeScale.h1, margin: 0 }}>Continuum Playground</h1>
          <div style={{ ...typeScale.caption, color: color.textSecondary }}>{activeScenarioTitle}</div>
          <div style={{ ...typeScale.caption, color: color.textMuted }}>{activeScenarioSubtitle}</div>
        </div>
        <div style={{ display: 'grid', gap: space.xs, justifyItems: 'end' }}>
          <div
            style={{
              display: 'flex',
              borderRadius: radius.sm,
              border: `1px solid ${color.border}`,
              overflow: 'hidden',
            }}
          >
            <button
              data-testid="protocol-native"
              onClick={() => onProtocolChange('native')}
              style={toggleStyle(protocolMode === 'native')}
            >
              Native
            </button>
            <button
              data-testid="protocol-a2ui"
              onClick={() => onProtocolChange('a2ui')}
              style={toggleStyle(protocolMode === 'a2ui')}
            >
              A2UI
            </button>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: space.sm, flexWrap: 'wrap' }}>
        {scenarios.map((scenario) => {
          const isActive = scenario.id === activeScenarioId;
          return (
            <button
              key={scenario.id}
              data-testid={`scenario-${scenario.id}`}
              onClick={() => onScenarioSelect(scenario.id)}
              style={{
                border: `1px solid ${isActive ? color.borderFocus : color.border}`,
                background: isActive ? color.surfaceHover : color.surface,
                color: isActive ? color.text : color.textSecondary,
                borderRadius: radius.pill,
                padding: `${space.sm}px ${space.md}px`,
                cursor: 'pointer',
                ...typeScale.caption,
              }}
            >
              {scenario.title}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function toggleStyle(active: boolean) {
  return {
    border: 'none',
    background: active ? color.accent : color.surface,
    color: active ? color.white : color.textSecondary,
    padding: `${space.xs}px ${space.md}px`,
    cursor: 'pointer',
    ...typeScale.caption,
  };
}

