import type { Scenario } from '../../scenarios/types';
import { radius, space, typeScale } from '../tokens';
import { playgroundTheme } from '../playground-theme';

type ProtocolMode = 'native' | 'a2ui';

interface StoryHeaderProps {
  onBackToIntro: () => void;
  scenarios: Scenario[];
  showScenarioTabs?: boolean;
  isAiMode?: boolean;
  activeScenarioId: string;
  activeScenarioTitle: string;
  activeScenarioSubtitle: string;
  protocolMode: ProtocolMode;
  onScenarioSelect: (scenarioId: string) => void;
  onProtocolChange: (mode: ProtocolMode) => void;
  onAiModeSelect?: () => void;
}

export function StoryHeader({
  onBackToIntro,
  scenarios,
  showScenarioTabs = true,
  isAiMode = false,
  activeScenarioId,
  activeScenarioTitle,
  activeScenarioSubtitle,
  protocolMode,
  onScenarioSelect,
  onProtocolChange,
  onAiModeSelect,
}: StoryHeaderProps) {
  return (
    <div style={{ display: 'grid', gap: space.md }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: space.lg, alignItems: 'center' }}>
        <div style={{ display: 'grid', gap: space.xs }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: space.md }}>
            <h1
              style={{
                ...typeScale.h1,
                margin: 0,
                fontFamily: playgroundTheme.type.display,
                letterSpacing: '-0.02em',
                color: playgroundTheme.color.text,
              }}
            >
              Continuum Playground
            </h1>
            <button
              data-testid="back-to-intro"
              onClick={onBackToIntro}
              style={{
                border: 'none',
                background: 'none',
                color: playgroundTheme.color.soft,
                cursor: 'pointer',
                ...typeScale.caption,
                letterSpacing: '0.02em',
                textTransform: 'uppercase',
                padding: 0,
              }}
            >
              Back to intro
            </button>
          </div>
          <div
            style={{
              ...typeScale.caption,
              color: playgroundTheme.color.muted,
              fontWeight: 600,
              letterSpacing: '0.02em',
            }}
          >
            {activeScenarioTitle}
          </div>
          <div style={{ ...typeScale.caption, color: playgroundTheme.color.soft }}>{activeScenarioSubtitle}</div>
        </div>
        <div style={{ display: 'grid', gap: space.xs, justifyItems: 'end' }}>
          <div
            style={{
              display: 'flex',
              borderRadius: radius.sm,
              border: `1px solid ${playgroundTheme.color.border}`,
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
      {showScenarioTabs ? (
        <div style={{ display: 'flex', gap: space.sm, flexWrap: 'wrap' }}>
          {onAiModeSelect ? (
            <button
              data-testid="scenario-ai-mode"
              onClick={onAiModeSelect}
              style={chipStyle(isAiMode)}
            >
              AI Mode
            </button>
          ) : null}
          {scenarios.map((scenario) => {
            const isActive = !isAiMode && scenario.id === activeScenarioId;
            return (
              <button
                key={scenario.id}
                data-testid={`scenario-${scenario.id}`}
                onClick={() => onScenarioSelect(scenario.id)}
                style={chipStyle(isActive)}
              >
                {scenario.title}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function toggleStyle(active: boolean) {
  return {
    border: 'none',
    background: active ? playgroundTheme.gradient.accent : playgroundTheme.color.surface,
    color: active ? playgroundTheme.color.white : playgroundTheme.color.text,
    padding: `${space.xs}px ${space.md}px`,
    cursor: 'pointer',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    ...typeScale.caption,
  };
}

function chipStyle(active: boolean) {
  return {
    border: `1px solid ${active ? playgroundTheme.color.accent : playgroundTheme.color.border}`,
    background: active ? playgroundTheme.gradient.accent : playgroundTheme.color.surface,
    color: active ? playgroundTheme.color.white : playgroundTheme.color.text,
    borderRadius: radius.pill,
    padding: `${space.sm}px ${space.md}px`,
    cursor: 'pointer',
    letterSpacing: '0.02em',
    textTransform: 'uppercase',
    ...typeScale.caption,
  };
}

