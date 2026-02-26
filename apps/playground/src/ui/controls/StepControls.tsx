import type { CSSProperties } from 'react';
import { color, radius, space, typeScale } from '../tokens';

interface StepControlsProps {
  stepIndex: number;
  totalSteps: number;
  activeStepLabel: string;
  stepProgress: string;
  description: string;
  narrativePrompt: string;
  onPrev: () => void;
  onNext: () => void;
  onHallucinate: () => void;
}

export function StepControls({
  stepIndex,
  totalSteps,
  activeStepLabel,
  stepProgress,
  description,
  narrativePrompt,
  onPrev,
  onNext,
  onHallucinate,
}: StepControlsProps) {
  const prevDisabled = stepIndex <= 0;
  const nextDisabled = stepIndex >= totalSteps - 1;

  return (
    <div
      style={{
        padding: space.lg,
        background: color.surface,
        borderRadius: radius.lg,
        border: `1px solid ${color.border}`,
        display: 'grid',
        gap: space.md,
      }}
    >
      <div style={{ ...typeScale.label, color: color.textMuted }}>Guided Scenario</div>
      <div style={{ display: 'flex', gap: space.sm, alignItems: 'center', flexWrap: 'wrap' }}>
        <button data-testid="btn-prev" disabled={prevDisabled} onClick={onPrev} style={btnStyle(prevDisabled)}>
          Prev
        </button>
        <button data-testid="btn-next" disabled={nextDisabled} onClick={onNext} style={btnStyle(nextDisabled)}>
          Next
        </button>
        <div style={{ display: 'grid', gap: 2 }}>
          <div data-testid="step-label" style={{ ...typeScale.caption, color: color.textSecondary }}>
            {activeStepLabel}
          </div>
          <div style={{ ...typeScale.caption, color: color.textMuted }}>{stepProgress}</div>
        </div>
        <button data-testid="btn-hallucinate" onClick={onHallucinate} style={dangerBtnStyle}>
          Chaos Jump
        </button>
      </div>
      <div style={{ ...typeScale.caption, color: color.textSecondary }}>{description}</div>
      <div style={{ ...typeScale.caption, color: color.textMuted }}>{narrativePrompt}</div>
    </div>
  );
}

function btnStyle(disabled: boolean): CSSProperties {
  return {
    borderRadius: radius.sm,
    border: `1px solid ${color.border}`,
    background: disabled ? color.surfaceAlt : color.surface,
    color: disabled ? color.textMuted : color.text,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    padding: `${space.sm}px ${space.lg}px`,
    transition: 'background 0.15s, border-color 0.15s',
    ...typeScale.caption,
  };
}

const dangerBtnStyle: CSSProperties = {
  borderRadius: radius.sm,
  border: `1px solid ${color.danger}`,
  background: color.danger,
  color: color.white,
  cursor: 'pointer',
  padding: `${space.sm}px ${space.lg}px`,
  marginLeft: 'auto',
  ...typeScale.caption,
};

