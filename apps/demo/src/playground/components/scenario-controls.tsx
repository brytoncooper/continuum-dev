import type { CSSProperties } from 'react';
import { FieldFrame, inputLikeStyle } from '../../primitives/shared/field-frame';
import { color, radius, space, type } from '../../ui/tokens';

const wrapStyle: CSSProperties = {
  display: 'grid',
  gap: space.lg,
  padding: space.xxl,
  borderRadius: radius.lg,
  border: `1px solid ${color.border}`,
  background: color.surface,
};

const controlsStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: space.sm,
  alignItems: 'center',
};

const navigationStyle: CSSProperties = {
  display: 'flex',
  gap: space.sm,
  justifyContent: 'flex-end',
  flexWrap: 'wrap',
};

const buttonStyle = (active: boolean): CSSProperties => ({
  ...type.small,
  color: color.text,
  padding: `${space.sm}px ${space.md}px`,
  borderRadius: radius.pill,
  border: `1px solid ${active ? color.borderStrong : color.border}`,
  background: active ? color.surface : color.surfaceMuted,
  cursor: 'pointer',
});

const navigationButtonStyle = (disabled: boolean): CSSProperties => ({
  ...type.small,
  color: disabled ? color.textSoft : color.text,
  padding: `${space.sm}px ${space.md}px`,
  borderRadius: radius.pill,
  border: `1px solid ${color.border}`,
  background: color.surface,
  cursor: disabled ? 'default' : 'pointer',
  opacity: disabled ? 0.6 : 1,
});

const inputHeaderStyle: CSSProperties = {
  display: 'grid',
  gap: space.xs,
};

const inputSectionStyle: CSSProperties = {
  display: 'grid',
  gap: space.lg,
};

const inputTitleStyle: CSSProperties = {
  ...type.label,
  color: color.text,
};

const inputDescriptionStyle: CSSProperties = {
  ...type.small,
  color: color.textMuted,
};

const inputGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: space.lg,
};

const fullRowStyle: CSSProperties = {
  gridColumn: '1 / -1',
};

export function ScenarioControls({
  inputTitle,
  inputDescription,
  inputFields,
  stepIndex,
  onStepChange,
  stepTitles,
}: {
  inputTitle?: string;
  inputDescription?: string;
  inputFields?: Array<{
    key: string;
    label: string;
    placeholder?: string;
    value: string;
    multiline?: boolean;
    onChange: (value: string) => void;
  }>;
  stepIndex: number;
  onStepChange: (stepIndex: number) => void;
  stepTitles: string[];
}) {
  const canGoPrevious = stepIndex > 0;
  const canGoNext = stepIndex < stepTitles.length - 1;

  return (
    <div style={wrapStyle}>
      {inputFields?.length ? (
        <div style={inputSectionStyle}>
          {inputTitle ? (
            <div style={inputHeaderStyle}>
              <div style={inputTitleStyle}>{inputTitle}</div>
              {inputDescription ? <div style={inputDescriptionStyle}>{inputDescription}</div> : null}
            </div>
          ) : null}
          <div style={inputGridStyle}>
            {inputFields.map((field) => (
              <div key={field.key} style={field.multiline ? fullRowStyle : undefined}>
                <FieldFrame label={field.label}>
                  {field.multiline ? (
                    <textarea
                      value={field.value}
                      placeholder={field.placeholder}
                      style={inputLikeStyle({ minHeight: 132, height: 'auto', resize: 'vertical' })}
                      onChange={(event) => field.onChange(event.target.value)}
                    />
                  ) : (
                    <input
                      value={field.value}
                      placeholder={field.placeholder}
                      style={inputLikeStyle()}
                      onChange={(event) => field.onChange(event.target.value)}
                    />
                  )}
                </FieldFrame>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <div style={controlsStyle}>
        {stepTitles.map((title, index) => (
          <button key={title} type="button" style={buttonStyle(index === stepIndex)} onClick={() => onStepChange(index)}>
            {title}
          </button>
        ))}
      </div>
      <div style={navigationStyle}>
        <button
          type="button"
          style={navigationButtonStyle(!canGoPrevious)}
          disabled={!canGoPrevious}
          onClick={() => onStepChange(stepIndex - 1)}
        >
          Previous
        </button>
        <button
          type="button"
          style={navigationButtonStyle(!canGoNext)}
          disabled={!canGoNext}
          onClick={() => onStepChange(stepIndex + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
