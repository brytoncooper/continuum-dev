import type { CSSProperties } from 'react';
import type { ComponentDefinition, ComponentState } from '@continuum/contract';
import type { ContinuumComponentMap, ContinuumComponentProps } from '@continuum/react';
import { color, radius, shadow, space, typeScale } from './ui/tokens';

type Option = { id: string; label: string };
type FieldShape = { placeholder?: string };
type ComponentPropsConfig = { options?: Option[]; min?: number; max?: number; placeholder?: string };

const FIELD_STYLE: CSSProperties = {
  display: 'grid',
  gap: space.xs,
};

const LABEL_STYLE: CSSProperties = {
  ...typeScale.caption,
  color: color.textSecondary,
  marginTop: 8,
};

const BASE_INPUT_STYLE: CSSProperties = {
  width: '100%',
  height: 40,
  padding: `${space.sm}px ${space.md}px`,
  borderRadius: radius.sm,
  border: `1px solid ${color.border}`,
  background: color.surface,
  color: color.text,
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
  ...typeScale.body,
};

function TextInput({ value, onChange, definition }: ContinuumComponentProps) {
  const raw = value as Record<string, unknown> | undefined;
  const textValue = typeof raw?.['value'] === 'string' ? raw['value'] : '';
  const shape = (definition.stateShape ?? {}) as FieldShape;
  const config = readPropsConfig(definition);
  const label = displayLabel(definition);
  const placeholder =
    definition.placeholder ??
    config.placeholder ??
    shape.placeholder ??
    `Enter ${label}`;
  const disabled = Boolean(definition.disabled);
  const readOnly = Boolean(definition.readOnly);

  return (
    <label className="continuum-field" style={FIELD_STYLE}>
      <div style={LABEL_STYLE}>
        {label}
        {definition.constraints?.required ? ' *' : ''}
      </div>
      <input
        style={BASE_INPUT_STYLE}
        value={textValue}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        onChange={(event) => onChange({ value: event.target.value } as ComponentState)}
      />
    </label>
  );
}

function Select({ value, onChange, definition }: ContinuumComponentProps) {
  const raw = value as Record<string, unknown> | undefined;
  const selected = (raw?.['selectedIds'] as string[]) ?? [];
  const config = readPropsConfig(definition);
  const options = readOptions(definition.stateShape, config.options);
  const disabled = Boolean(definition.disabled);
  const readOnly = Boolean(definition.readOnly);
  const label = displayLabel(definition);

  return (
    <label className="continuum-field" style={FIELD_STYLE}>
      <div style={LABEL_STYLE}>
        {label}
        {definition.constraints?.required ? ' *' : ''}
      </div>
      <select
        style={{
          ...BASE_INPUT_STYLE,
          cursor: 'pointer',
          appearance: 'none',
          backgroundImage:
            'linear-gradient(45deg, transparent 50%, #8b97a8 50%), linear-gradient(135deg, #8b97a8 50%, transparent 50%)',
          backgroundPosition: 'calc(100% - 16px) calc(50% - 3px), calc(100% - 10px) calc(50% - 3px)',
          backgroundSize: '6px 6px, 6px 6px',
          backgroundRepeat: 'no-repeat',
          paddingRight: 32,
        }}
        value={selected[0] ?? ''}
        disabled={disabled || readOnly}
        onChange={(event) =>
          onChange({
            selectedIds: event.target.value ? [event.target.value] : [],
          } as ComponentState)
        }
      >
        <option value="">Select one</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Toggle({ value, onChange, definition }: ContinuumComponentProps) {
  const raw = value as Record<string, unknown> | undefined;
  const checked = Boolean(raw?.['checked']);
  const disabled = Boolean(definition.disabled);
  const readOnly = Boolean(definition.readOnly);

  return (
    <label
      className="continuum-field"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: space.sm,
        cursor: 'pointer',
      }}
    >
      <span
        style={{
          width: 44,
          height: 24,
          borderRadius: radius.pill,
          background: checked ? color.success : color.border,
          position: 'relative',
          transition: 'background 0.2s',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 2,
            left: checked ? 22 : 2,
            width: 20,
            height: 20,
            borderRadius: radius.pill,
            background: color.white,
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            transition: 'left 0.2s ease',
          }}
        />
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(event) => {
            if (readOnly) return;
            onChange({ checked: event.target.checked } as ComponentState);
          }}
          style={{
            opacity: 0,
            position: 'absolute',
            inset: 0,
            cursor: 'pointer',
          }}
        />
      </span>
      <span style={{ ...typeScale.body, color: color.text }}>
        {displayLabel(definition)}
      </span>
    </label>
  );
}

function DateInput({ value, onChange, definition }: ContinuumComponentProps) {
  const raw = value as Record<string, unknown> | undefined;
  const dateValue = typeof raw?.['value'] === 'string' ? raw['value'] : '';
  const label = displayLabel(definition);
  const disabled = Boolean(definition.disabled);
  const readOnly = Boolean(definition.readOnly);

  return (
    <label style={FIELD_STYLE}>
      <div style={LABEL_STYLE}>
        {label}
        {definition.constraints?.required ? ' *' : ''}
      </div>
      <input
        type="date"
        style={{
          ...BASE_INPUT_STYLE,
          cursor: 'pointer',
          appearance: 'auto',
          WebkitAppearance: 'auto',
        }}
        value={dateValue}
        disabled={disabled}
        readOnly={readOnly}
        onChange={(event) => onChange({ value: event.target.value } as ComponentState)}
        onClick={(event) => {
          const input = event.currentTarget;
          if (typeof input.showPicker === 'function') {
            input.showPicker();
          }
        }}
      />
    </label>
  );
}

function TextArea({ value, onChange, definition }: ContinuumComponentProps) {
  const raw = value as Record<string, unknown> | undefined;
  const textValue = typeof raw?.['value'] === 'string' ? raw['value'] : '';
  const shape = (definition.stateShape ?? {}) as FieldShape;
  const config = readPropsConfig(definition);
  const label = displayLabel(definition);
  const placeholder =
    definition.placeholder ??
    config.placeholder ??
    shape.placeholder ??
    `Enter ${label}`;
  const disabled = Boolean(definition.disabled);
  const readOnly = Boolean(definition.readOnly);

  return (
    <label className="continuum-field" style={FIELD_STYLE}>
      <div style={LABEL_STYLE}>
        {label}
        {definition.constraints?.required ? ' *' : ''}
      </div>
      <textarea
        style={{
          ...BASE_INPUT_STYLE,
          minHeight: 92,
          height: 'auto',
          resize: 'vertical',
          fontFamily: 'inherit',
        }}
        value={textValue}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        onChange={(event) => onChange({ value: event.target.value } as ComponentState)}
      />
    </label>
  );
}

function RadioGroup({ value, onChange, definition }: ContinuumComponentProps) {
  const raw = value as Record<string, unknown> | undefined;
  const selected = (raw?.['selectedIds'] as string[]) ?? [];
  const config = readPropsConfig(definition);
  const options = readOptions(definition.stateShape, config.options);
  const label = displayLabel(definition);
  const disabled = Boolean(definition.disabled);
  const readOnly = Boolean(definition.readOnly);

  return (
    <div style={FIELD_STYLE}>
      <div style={LABEL_STYLE}>
        {label}
        {definition.constraints?.required ? ' *' : ''}
      </div>
      <div style={{ display: 'grid', gap: space.sm }}>
        {options.map((option) => (
          <label
            key={option.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: space.sm,
              cursor: 'pointer',
              ...typeScale.body,
              color: color.text,
            }}
          >
            <input
              type="radio"
              name={definition.id}
              checked={selected[0] === option.id}
              disabled={disabled}
              onChange={() => {
                if (readOnly) return;
                onChange({ selectedIds: [option.id] } as ComponentState);
              }}
              style={{ accentColor: color.accent, width: 16, height: 16, cursor: 'pointer' }}
            />
            {option.label}
          </label>
        ))}
      </div>
    </div>
  );
}

function Slider({ value, onChange, definition }: ContinuumComponentProps) {
  const raw = value as Record<string, unknown> | undefined;
  const config = readPropsConfig(definition);
  const min = config.min ?? definition.constraints?.min ?? 0;
  const max = config.max ?? definition.constraints?.max ?? 100;
  const midpoint = Math.round((min + max) / 2);
  const numericValue = typeof raw?.['value'] === 'number' ? raw['value'] : midpoint;
  const disabled = Boolean(definition.disabled);
  const readOnly = Boolean(definition.readOnly);

  return (
    <label className="continuum-field" style={FIELD_STYLE}>
      <div style={{ ...LABEL_STYLE, display: 'flex', justifyContent: 'space-between' }}>
        <span>
          {displayLabel(definition)}
          {definition.constraints?.required ? ' *' : ''}
        </span>
        <span style={{ color: color.text }}>{numericValue}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={numericValue}
        disabled={disabled}
        onChange={(event) => {
          if (readOnly) return;
          onChange({ value: Number(event.target.value) } as ComponentState);
        }}
        style={{
          width: '100%',
          accentColor: color.accent,
          cursor: 'pointer',
          height: 4,
        }}
      />
      <div style={{ ...typeScale.caption, color: color.textMuted }}>
        {min} - {max}
      </div>
    </label>
  );
}

function Section({ definition, children }: ContinuumComponentProps) {
  return (
    <div
      style={{
        padding: space.xl,
        borderRadius: radius.lg,
        background: color.surface,
        border: `1px solid ${color.border}`,
        boxShadow: shadow.card,
      }}
    >
      <div
        style={{
          ...typeScale.h3,
          color: color.text,
          paddingBottom: space.md,
          marginBottom: space.lg,
          borderBottom: `1px solid ${color.border}`,
        }}
      >
        {displayLabel(definition)}
      </div>
      <div style={{ display: 'grid', gap: space.lg }}>{children}</div>
    </div>
  );
}

function Container({ definition, children }: ContinuumComponentProps) {
  return (
    <div
      style={{
        padding: space.lg,
        border: `1px solid ${color.border}`,
        borderRadius: radius.lg,
        background: color.surfaceAlt,
        display: 'grid',
        gap: space.md,
      }}
    >
      <div style={LABEL_STYLE}>{displayLabel(definition)}</div>
      <div style={{ display: 'grid', gap: space.md }}>{children}</div>
    </div>
  );
}

function displayLabel(definition: ComponentDefinition): string {
  return definition.label ?? definition.path ?? definition.key ?? definition.id ?? 'Field';
}

function readOptions(shape: unknown, fromProps?: Option[]): Option[] {
  if (Array.isArray(fromProps)) {
    return fromProps;
  }
  if (Array.isArray(shape)) {
    return shape as Option[];
  }
  return [];
}

function readPropsConfig(definition: ComponentDefinition): ComponentPropsConfig {
  return (definition.props ?? {}) as ComponentPropsConfig;
}

export const componentMap: ContinuumComponentMap = {
  input: TextInput,
  select: Select,
  toggle: Toggle,
  date: DateInput,
  textarea: TextArea,
  'radio-group': RadioGroup,
  slider: Slider,
  section: Section,
  container: Container,
  default: Container,
};
