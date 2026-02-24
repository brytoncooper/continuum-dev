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
  container: Container,
  default: Container,
};
