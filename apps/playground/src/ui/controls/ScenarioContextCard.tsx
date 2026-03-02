import type { CSSProperties } from 'react';
import type { Checkpoint } from '@continuum/contract';
import { radius, space, typeScale } from '../tokens';
import { playgroundTheme } from '../playground-theme';

interface ScenarioContextCardProps {
  stepIndex: number;
  totalSteps: number;
  activeStepLabel: string;
  description: string;
  narrativePrompt: string;
  checkpoints: Checkpoint[];
  onPrev: () => void;
  onNext: () => void;
  onRewind: (id: string) => void;
  onHallucinate: () => void;
}

export function ScenarioContextCard({
  stepIndex,
  totalSteps,
  activeStepLabel,
  description,
  narrativePrompt,
  checkpoints,
  onPrev,
  onNext,
  onRewind,
  onHallucinate,
}: ScenarioContextCardProps) {
  const prevDisabled = stepIndex <= 0;
  const nextDisabled = stepIndex >= totalSteps - 1;

  return (
    <div
      style={{
        padding: space.xl,
        background: `linear-gradient(160deg, ${playgroundTheme.color.surface} 0%, rgba(247, 245, 255, 0.96) 60%, rgba(240, 252, 249, 0.95) 100%)`,
        borderRadius: radius.lg,
        border: `1px solid ${playgroundTheme.color.panelBorder}`,
        boxShadow: `${playgroundTheme.shadow.card}, inset 0 0 0 1px ${playgroundTheme.color.borderGlow}`,
        display: 'grid',
        gap: space.lg,
      }}
    >
      <div
        style={{
          ...typeScale.label,
          color: playgroundTheme.color.soft,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}
      >
        Guided Scenario
      </div>
      <div
        data-testid="rewind-timeline"
        style={{ display: 'flex', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}
      >
        {Array.from({ length: totalSteps }, (_, i) => {
          const isCurrent = i === stepIndex;
          const hasCheckpoint = Boolean(checkpoints[i]);
          return (
            <button
              key={i}
              data-testid={hasCheckpoint ? `rewind-${i}` : undefined}
              onClick={() => hasCheckpoint && onRewind(checkpoints[i].checkpointId)}
              title={hasCheckpoint ? `Rewind to ${checkpoints[i].snapshot.view.version}` : undefined}
              style={{
                width: 28,
                height: 28,
                borderRadius: radius.pill,
                border: `2px solid ${isCurrent ? playgroundTheme.color.accent : playgroundTheme.color.border}`,
                background: isCurrent ? playgroundTheme.color.accent : playgroundTheme.color.surface,
                color: isCurrent ? playgroundTheme.color.white : playgroundTheme.color.text,
                cursor: hasCheckpoint ? 'pointer' : 'default',
                ...typeScale.caption,
                fontWeight: 600,
              }}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      <div>
        <div
          data-testid="step-label"
          style={{
            ...typeScale.h3,
            color: playgroundTheme.color.text,
            marginBottom: space.xs,
          }}
        >
          {activeStepLabel}
        </div>
        <div style={{ ...typeScale.caption, color: playgroundTheme.color.muted, marginBottom: space.xs }}>
          {description}
        </div>
        {narrativePrompt ? (
          <div style={{ ...typeScale.caption, color: playgroundTheme.color.soft }}>{narrativePrompt}</div>
        ) : null}
      </div>
      <div style={{ display: 'flex', gap: space.sm, alignItems: 'center', flexWrap: 'wrap' }}>
        <button data-testid="btn-prev" disabled={prevDisabled} onClick={onPrev} style={btnStyle(prevDisabled)}>
          Prev
        </button>
        <button data-testid="btn-next" disabled={nextDisabled} onClick={onNext} style={btnStyle(nextDisabled)}>
          Next
        </button>
        <span
          style={{
            ...typeScale.caption,
            color: playgroundTheme.color.soft,
            letterSpacing: '0.04em',
            fontWeight: 600,
          }}
        >
          {stepIndex + 1} of {totalSteps}
        </span>
        <button data-testid="btn-hallucinate" onClick={onHallucinate} style={ghostBtnStyle}>
          Chaos Jump
        </button>
      </div>
    </div>
  );
}

function btnStyle(disabled: boolean): CSSProperties {
  return {
    borderRadius: radius.sm,
    border: `1px solid ${playgroundTheme.color.border}`,
    background: disabled ? playgroundTheme.color.surfaceMuted : playgroundTheme.color.surface,
    color: disabled ? playgroundTheme.color.soft : playgroundTheme.color.text,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    padding: `${space.sm}px ${space.lg}px`,
    transition: playgroundTheme.transition.normal,
    ...typeScale.caption,
  };
}

const ghostBtnStyle: CSSProperties = {
  borderRadius: radius.sm,
  border: `1px solid ${playgroundTheme.color.border}`,
  background: 'transparent',
  color: playgroundTheme.color.muted,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  cursor: 'pointer',
  padding: `${space.sm}px ${space.lg}px`,
  marginLeft: 'auto',
  ...typeScale.caption,
};
