import type { CSSProperties } from 'react';
import type { ComponentState } from '@continuum/contract';
import type { ContinuumComponentMap, ContinuumComponentProps } from '@continuum/react';
import { color, radius, shadow, space, typeScale } from './ui/tokens';

type Option = { id: string; label: string };
type FieldShape = { placeholder?: string };

const FIELD_STYLE: CSSProperties = {
  display: 'grid',
  gap: space.xs,
};

const LABEL_STYLE: CSSProperties = {
  ...typeScale.caption,
  color: color.textSecondary,
};

const BASE_INPUT_STYLE: CSSProperties = {
  width: '100%',
  height: 40,
  padding: `${space.sm}px ${space.md}px`,
  borderRadius: radius.sm,
  border: `1px solid ${color.border}`,
  background: color.bg,
  color: color.text,
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s, box-shadow 0.15s',
  ...typeScale.body,
};

function TextInput({ value, onChange, definition }: ContinuumComponentProps) {
  const raw = value as Record<string, unknown> | undefined;
  const textValue = typeof raw?.['value'] === 'string' ? raw['value'] : '';
  const shape = (definition.stateShape ?? {}) as FieldShape;

  return (
    <label style={FIELD_STYLE}>
      <div style={LABEL_STYLE}>{displayLabel(definition.path, definition.key, definition.id)}</div>
      <input
        style={BASE_INPUT_STYLE}
        value={textValue}
        placeholder={shape.placeholder ?? `Enter ${displayLabel(definition.path, definition.key, definition.id)}`}
        onChange={(event) => onChange({ value: event.target.value } as ComponentState)}
      />
    </label>
  );
}

function Select({ value, onChange, definition }: ContinuumComponentProps) {
  const raw = value as Record<string, unknown> | undefined;
  const selected = (raw?.['selectedIds'] as string[]) ?? [];
  const options = readOptions(definition.stateShape);

  return (
    <label style={FIELD_STYLE}>
      <div style={LABEL_STYLE}>{displayLabel(definition.path, definition.key, definition.id)}</div>
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

  return (
    <label
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
            transition: 'left 0.2s',
          }}
        />
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange({ checked: event.target.checked } as ComponentState)}
          style={{
            opacity: 0,
            position: 'absolute',
            inset: 0,
            cursor: 'pointer',
          }}
        />
      </span>
      <span style={{ ...typeScale.body, color: color.text }}>
        {displayLabel(definition.path, definition.key, definition.id)}
      </span>
    </label>
  );
}

function DateInput({ value, onChange, definition }: ContinuumComponentProps) {
  const raw = value as Record<string, unknown> | undefined;
  const dateValue = typeof raw?.['value'] === 'string' ? raw['value'] : '';

  return (
    <label style={FIELD_STYLE}>
      <div style={LABEL_STYLE}>{displayLabel(definition.path, definition.key, definition.id)}</div>
      <input
        type="date"
        style={{ ...BASE_INPUT_STYLE, cursor: 'pointer', colorScheme: 'dark' }}
        value={dateValue}
        onChange={(event) => onChange({ value: event.target.value } as ComponentState)}
      />
    </label>
  );
}

function TextArea({ value, onChange, definition }: ContinuumComponentProps) {
  const raw = value as Record<string, unknown> | undefined;
  const textValue = typeof raw?.['value'] === 'string' ? raw['value'] : '';
  const shape = (definition.stateShape ?? {}) as FieldShape;

  return (
    <label style={FIELD_STYLE}>
      <div style={LABEL_STYLE}>{displayLabel(definition.path, definition.key, definition.id)}</div>
      <textarea
        style={{
          ...BASE_INPUT_STYLE,
          minHeight: 92,
          height: 'auto',
          resize: 'vertical',
          fontFamily: 'inherit',
        }}
        value={textValue}
        placeholder={shape.placeholder ?? `Enter ${displayLabel(definition.path, definition.key, definition.id)}`}
        onChange={(event) => onChange({ value: event.target.value } as ComponentState)}
      />
    </label>
  );
}

function RadioGroup({ value, onChange, definition }: ContinuumComponentProps) {
  const raw = value as Record<string, unknown> | undefined;
  const selected = (raw?.['selectedIds'] as string[]) ?? [];
  const options = readOptions(definition.stateShape);

  return (
    <div style={FIELD_STYLE}>
      <div style={LABEL_STYLE}>{displayLabel(definition.path, definition.key, definition.id)}</div>
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
              onChange={() => onChange({ selectedIds: [option.id] } as ComponentState)}
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
  const numericValue = typeof raw?.['value'] === 'number' ? raw['value'] : 50;

  return (
    <label style={FIELD_STYLE}>
      <div style={{ ...LABEL_STYLE, display: 'flex', justifyContent: 'space-between' }}>
        <span>{displayLabel(definition.path, definition.key, definition.id)}</span>
        <span style={{ color: color.text }}>{numericValue}</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={numericValue}
        onChange={(event) => onChange({ value: Number(event.target.value) } as ComponentState)}
        style={{
          width: '100%',
          accentColor: color.accent,
          cursor: 'pointer',
          height: 4,
        }}
      />
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
        {displayLabel(definition.path, definition.key, definition.id)}
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
      <div style={LABEL_STYLE}>{displayLabel(definition.path, definition.key, definition.id)}</div>
      <div style={{ display: 'grid', gap: space.md }}>{children}</div>
    </div>
  );
}

function displayLabel(path?: string, key?: string, id?: string): string {
  return path ?? key ?? id ?? 'Field';
}

function readOptions(shape: unknown): Option[] {
  if (Array.isArray(shape)) {
    return shape as Option[];
  }
  return [];
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
