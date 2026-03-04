import type { CSSProperties } from 'react';
import { useMemo, useState } from 'react';
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
  onCreateCheckpoint: () => void;
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
  onCreateCheckpoint,
  onHallucinate,
}: ScenarioContextCardProps) {
  const prevDisabled = stepIndex <= 0;
  const nextDisabled = stepIndex >= totalSteps - 1;
  const [timelineExpanded, setTimelineExpanded] = useState(false);
  const latestCheckpoint = useMemo(() => checkpoints[checkpoints.length - 1] ?? null, [checkpoints]);

  return (
    <div
      style={{
        padding: space.xl,
        background: `linear-gradient(160deg, ${playgroundTheme.color.surface} 0%, rgba(247, 245, 255, 0.96) 60%, rgba(240, 252, 249, 0.95) 100%)`,
        borderRadius: radius.lg,
        border: `1px solid ${playgroundTheme.color.panelBorder}`,
        boxShadow: `${playgroundTheme.shadow.card}, inset 0 0 0 1px ${playgroundTheme.color.borderGlow}`,
        display: 'grid',
        gap: space.sectionGap,
      }}
    >
      <div
        style={{
          ...typeScale.overline,
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
      <div
        style={{
          display: 'grid',
          gap: space.stackGap,
          padding: space.md,
          borderRadius: radius.md,
          border: `1px solid ${playgroundTheme.color.border}`,
          background: playgroundTheme.color.surfaceAlt,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: space.sm }}>
          <div style={{ display: 'grid', gap: 2 }}>
            <div style={{ ...typeScale.caption, color: playgroundTheme.color.muted, textTransform: 'uppercase' }}>
              Checkpoint Timeline
            </div>
            <div style={{ ...typeScale.caption, color: playgroundTheme.color.text }}>
              {checkpoints.length} checkpoint{checkpoints.length === 1 ? '' : 's'}
            </div>
          </div>
          <button
            onClick={onCreateCheckpoint}
            style={{
              ...typeScale.caption,
              borderRadius: radius.sm,
              border: `1px solid ${playgroundTheme.color.accent}`,
              background: playgroundTheme.color.accent,
              color: playgroundTheme.color.white,
              padding: `6px ${space.sm}px`,
              cursor: 'pointer',
              textTransform: 'uppercase',
            }}
          >
            Create checkpoint
          </button>
        </div>
        {latestCheckpoint ? (
          <div
            style={{
              display: 'grid',
              gap: 2,
              padding: `${space.xs}px ${space.sm}px`,
              borderRadius: radius.sm,
              border: `1px solid ${playgroundTheme.color.borderStrong}`,
              background: playgroundTheme.color.surface,
            }}
          >
            <div style={{ ...typeScale.caption, color: playgroundTheme.color.text }}>
              Latest: v{latestCheckpoint.snapshot.view.version}
            </div>
            <div style={{ ...typeScale.caption, color: playgroundTheme.color.soft, fontSize: 11 }}>
              {new Date(latestCheckpoint.timestamp).toLocaleString()} | {latestCheckpoint.trigger}
            </div>
          </div>
        ) : (
          <div style={{ ...typeScale.caption, color: playgroundTheme.color.soft }}>No checkpoints yet</div>
        )}
        <div style={{ display: 'flex', gap: space.inlineGap, flexWrap: 'wrap' }}>
          <button
            onClick={() => latestCheckpoint && onRewind(latestCheckpoint.checkpointId)}
            disabled={!latestCheckpoint}
            style={btnStyle(!latestCheckpoint)}
          >
            Rewind to latest
          </button>
          <button
            onClick={() => setTimelineExpanded((value) => !value)}
            style={{
              ...ghostBtnStyle,
              marginLeft: 0,
              textTransform: 'none',
              letterSpacing: 'normal',
            }}
          >
            {timelineExpanded ? 'Hide timeline' : 'Open timeline'}
          </button>
        </div>
        {timelineExpanded ? (
          <div
            style={{
              maxHeight: 180,
              overflow: 'auto',
              display: 'grid',
              gap: space.xs,
              padding: space.xs,
              border: `1px solid ${playgroundTheme.color.border}`,
              borderRadius: radius.sm,
              background: playgroundTheme.color.surface,
            }}
          >
            {[...checkpoints].reverse().map((checkpoint) => (
              <button
                key={checkpoint.checkpointId}
                onClick={() => onRewind(checkpoint.checkpointId)}
                style={{
                  borderRadius: radius.sm,
                  border: `1px solid ${playgroundTheme.color.border}`,
                  background: 'transparent',
                  color: playgroundTheme.color.text,
                  padding: `${space.sm}px ${space.sm}px`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  ...typeScale.caption,
                }}
              >
                <span>v{checkpoint.snapshot.view.version}</span>
                <span style={{ color: playgroundTheme.color.soft, fontSize: 11 }}>
                  {new Date(checkpoint.timestamp).toLocaleTimeString()}
                </span>
              </button>
            ))}
          </div>
        ) : null}
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
            fontWeight: 600,
          }}
        >
          {stepIndex + 1} of {totalSteps}
        </span>
        <button data-testid="btn-hallucinate" onClick={onHallucinate} style={ghostBtnStyle}>
          Chaos test
        </button>
      </div>
    </div>
  );
}

function btnStyle(disabled: boolean): CSSProperties {
  return {
    borderRadius: radius.sm,
    border: `1px solid ${playgroundTheme.color.borderStrong}`,
    background: disabled ? playgroundTheme.color.disabledBg : playgroundTheme.color.surface,
    color: disabled ? playgroundTheme.color.disabledText : playgroundTheme.color.text,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.7 : 1,
    padding: `${space.sm}px ${space.lg}px`,
    transition: playgroundTheme.transition.normal,
    ...typeScale.caption,
  };
}

const ghostBtnStyle: CSSProperties = {
  borderRadius: radius.sm,
  border: `1px solid ${playgroundTheme.color.borderStrong}`,
  background: 'transparent',
  color: playgroundTheme.color.muted,
  cursor: 'pointer',
  padding: `${space.sm}px ${space.lg}px`,
  marginLeft: 'auto',
  ...typeScale.caption,
};
