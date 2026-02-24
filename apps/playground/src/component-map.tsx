import type { ComponentState } from '@continuum/contract';
import type { ContinuumComponentMap, ContinuumComponentProps } from '@continuum/react';

const FIELD_STYLE: React.CSSProperties = {
  display: 'grid',
  gap: 6,
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: '#8b949e',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const INPUT_STYLE: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 6,
  border: '1px solid #30363d',
  background: '#0d1117',
  color: '#e6edf3',
  fontSize: 14,
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
};

function TextInput({ value, onChange, definition }: ContinuumComponentProps) {
  const raw = value as Record<string, unknown> | undefined;
  const textValue = typeof raw?.['value'] === 'string' ? raw['value'] : '';

  return (
    <label style={FIELD_STYLE}>
      <div style={LABEL_STYLE}>{definition.key ?? definition.id}</div>
      <input
        style={INPUT_STYLE}
        value={textValue as string}
        placeholder={`Enter ${definition.key ?? definition.id}...`}
        onChange={(e) => onChange({ value: e.target.value } as ComponentState)}
      />
    </label>
  );
}

function Select({ value, onChange, definition }: ContinuumComponentProps) {
  const raw = value as Record<string, unknown> | undefined;
  const selected = (raw?.['selectedIds'] as string[]) ?? [];

  return (
    <label style={FIELD_STYLE}>
      <div style={LABEL_STYLE}>{definition.key ?? definition.id}</div>
      <select
        style={{ ...INPUT_STYLE, cursor: 'pointer' }}
        value={selected[0] ?? ''}
        onChange={(e) =>
          onChange({
            selectedIds: e.target.value ? [e.target.value] : [],
          } as ComponentState)
        }
      >
        <option value="">-- select --</option>
        <option value="opt-a">Option A</option>
        <option value="opt-b">Option B</option>
        <option value="opt-c">Option C</option>
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
        gap: 10,
        alignItems: 'center',
        cursor: 'pointer',
        padding: '4px 0',
      }}
    >
      <div
        style={{
          width: 36,
          height: 20,
          borderRadius: 10,
          background: checked ? '#3fb950' : '#30363d',
          position: 'relative',
          transition: 'background 0.15s',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: '#e6edf3',
            position: 'absolute',
            top: 2,
            left: checked ? 18 : 2,
            transition: 'left 0.15s',
          }}
        />
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange({ checked: e.target.checked } as ComponentState)}
          style={{ opacity: 0, position: 'absolute', width: '100%', height: '100%', cursor: 'pointer' }}
        />
      </div>
      <span style={{ fontSize: 13, color: '#e6edf3' }}>{definition.key ?? definition.id}</span>
    </label>
  );
}

function DateInput({ value, onChange, definition }: ContinuumComponentProps) {
  const raw = value as Record<string, unknown> | undefined;
  const dateValue = typeof raw?.['value'] === 'string' ? raw['value'] : '';

  return (
    <label style={FIELD_STYLE}>
      <div style={LABEL_STYLE}>{definition.key ?? definition.id}</div>
      <input
        type="date"
        style={{ ...INPUT_STYLE, cursor: 'pointer', colorScheme: 'dark' }}
        value={dateValue}
        onChange={(e) => onChange({ value: e.target.value } as ComponentState)}
      />
    </label>
  );
}

function TextArea({ value, onChange, definition }: ContinuumComponentProps) {
  const raw = value as Record<string, unknown> | undefined;
  const textValue = typeof raw?.['value'] === 'string' ? raw['value'] : '';

  return (
    <label style={FIELD_STYLE}>
      <div style={LABEL_STYLE}>{definition.key ?? definition.id}</div>
      <textarea
        style={{ ...INPUT_STYLE, minHeight: 80, resize: 'vertical', fontFamily: 'inherit' }}
        value={textValue}
        placeholder={`Enter ${definition.key ?? definition.id}...`}
        onChange={(e) => onChange({ value: e.target.value } as ComponentState)}
      />
    </label>
  );
}

function RadioGroup({ value, onChange, definition }: ContinuumComponentProps) {
  const raw = value as Record<string, unknown> | undefined;
  const selected = (raw?.['selectedIds'] as string[]) ?? [];
  const options = Array.isArray(definition.stateShape)
    ? (definition.stateShape as { id: string; label: string }[])
    : [
        { id: 'opt-a', label: 'Option A' },
        { id: 'opt-b', label: 'Option B' },
        { id: 'opt-c', label: 'Option C' },
      ];

  return (
    <div style={FIELD_STYLE}>
      <div style={LABEL_STYLE}>{definition.key ?? definition.id}</div>
      <div style={{ display: 'grid', gap: 6 }}>
        {options.map((opt) => (
          <label
            key={opt.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              fontSize: 13,
              color: '#e6edf3',
            }}
          >
            <input
              type="radio"
              name={definition.id}
              checked={selected[0] === opt.id}
              onChange={() =>
                onChange({ selectedIds: [opt.id] } as ComponentState)
              }
              style={{ accentColor: '#58a6ff', cursor: 'pointer' }}
            />
            {opt.label}
          </label>
        ))}
      </div>
    </div>
  );
}

function Slider({ value, onChange, definition }: ContinuumComponentProps) {
  const raw = value as Record<string, unknown> | undefined;
  const numValue = typeof raw?.['value'] === 'number' ? raw['value'] : 50;

  return (
    <label style={FIELD_STYLE}>
      <div style={{ ...LABEL_STYLE, display: 'flex', justifyContent: 'space-between' }}>
        <span>{definition.key ?? definition.id}</span>
        <span style={{ color: '#e6edf3', fontWeight: 400 }}>{numValue}</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={numValue}
        onChange={(e) => onChange({ value: Number(e.target.value) } as ComponentState)}
        style={{
          width: '100%',
          accentColor: '#58a6ff',
          cursor: 'pointer',
          height: 6,
        }}
      />
    </label>
  );
}

function Section({ definition, children }: ContinuumComponentProps) {
  return (
    <div
      style={{
        padding: '12px 16px',
        borderRadius: 8,
        background: '#161b22',
        border: '1px solid #30363d',
      }}
    >
      <div
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: '#e6edf3',
          paddingBottom: 8,
          marginBottom: 10,
          borderBottom: '1px solid #30363d',
          letterSpacing: '-0.01em',
        }}
      >
        {definition.path ?? definition.key ?? definition.id}
      </div>
      <div style={{ display: 'grid', gap: 12 }}>{children}</div>
    </div>
  );
}

function Container({ definition, children }: ContinuumComponentProps) {
  return (
    <div
      style={{
        padding: 12,
        border: '1px solid #30363d',
        borderRadius: 8,
        background: '#161b22',
      }}
    >
      <div style={{ ...LABEL_STYLE, marginBottom: 8 }}>
        {definition.key ?? definition.id}
      </div>
      {children}
    </div>
  );
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
