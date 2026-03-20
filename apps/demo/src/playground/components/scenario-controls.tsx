import type { CSSProperties } from 'react';
import { FieldFrame, inputLikeStyle } from '@continuum-dev/starter-kit';
import { color, radius, space, type } from '../../ui/tokens';
import { useResponsiveState } from '../../ui/responsive';

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
  flexWrap: 'nowrap',
  gap: space.sm,
  alignItems: 'center',
};

const navigationStyle: CSSProperties = {
  display: 'flex',
  gap: space.sm,
  justifyContent: 'space-between',
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

const progressStyle: CSSProperties = {
  display: 'grid',
  gap: space.xs,
};

const progressLabelStyle: CSSProperties = {
  ...type.label,
  color: color.textSoft,
};

const progressTitleStyle: CSSProperties = {
  ...type.body,
  color: color.text,
};

const progressDescriptionStyle: CSSProperties = {
  ...type.small,
  color: color.textMuted,
};

const selectWrapStyle: CSSProperties = {
  display: 'grid',
  gap: space.xs,
  minWidth: 240,
};

const selectLabelStyle: CSSProperties = {
  ...type.small,
  color: color.textSoft,
};

const selectStyle: CSSProperties = {
  ...type.small,
  color: color.text,
  borderRadius: radius.md,
  border: `1px solid ${color.border}`,
  background: color.surface,
  padding: `${space.sm}px ${space.md}px`,
};

export function ScenarioControls({
  inputTitle,
  inputDescription,
  inputFields,
  stepIndex,
  onStepChange,
  stepTitles,
  stepDescription,
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
  stepDescription?: string;
}) {
  const canGoPrevious = stepIndex > 0;
  const canGoNext = stepIndex < stepTitles.length - 1;
  const { isMobile } = useResponsiveState();

  return (
    <div style={{ ...wrapStyle, padding: isMobile ? space.xl : wrapStyle.padding }}>
      {inputFields?.length ? (
        <div style={inputSectionStyle}>
          {inputTitle ? (
            <div style={inputHeaderStyle}>
              <div style={inputTitleStyle}>{inputTitle}</div>
              {inputDescription ? (
                <div style={inputDescriptionStyle}>{inputDescription}</div>
              ) : null}
            </div>
          ) : null}
          <div
            style={{
              ...inputGridStyle,
              gridTemplateColumns: isMobile
                ? 'minmax(0, 1fr)'
                : inputGridStyle.gridTemplateColumns,
            }}
          >
            {inputFields.map((field) => (
              <div
                key={field.key}
                style={field.multiline ? fullRowStyle : undefined}
              >
                <FieldFrame label={field.label}>
                  {field.multiline ? (
                    <textarea
                      value={field.value}
                      placeholder={field.placeholder}
                      style={inputLikeStyle({
                        minHeight: 132,
                        height: 'auto',
                        resize: 'vertical',
                      })}
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
      <div style={progressStyle}>
        <div style={progressLabelStyle}>{`Step ${stepIndex + 1} of ${stepTitles.length}`}</div>
        <div style={progressTitleStyle}>{stepTitles[stepIndex]}</div>
        {stepDescription ? <div style={progressDescriptionStyle}>{stepDescription}</div> : null}
      </div>
      <div style={navigationStyle}>
        <div
          style={{
            ...controlsStyle,
            width: isMobile ? '100%' : 'auto',
            justifyContent: isMobile ? 'space-between' : 'flex-start',
          }}
        >
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
        <label style={selectWrapStyle}>
          <span style={selectLabelStyle}>Jump to step</span>
          <select
            value={stepIndex}
            style={selectStyle}
            onChange={(event) => onStepChange(Number(event.target.value))}
          >
            {stepTitles.map((title, index) => (
              <option key={title} value={index}>
                {title}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div style={{ ...controlsStyle, flexWrap: 'wrap' }}>
        {stepTitles.map((title, index) => (
          <button
            key={title}
            type="button"
            style={buttonStyle(index === stepIndex)}
            onClick={() => onStepChange(index)}
          >
            {index + 1}
          </button>
        ))}
      </div>
    </div>
  );
}
