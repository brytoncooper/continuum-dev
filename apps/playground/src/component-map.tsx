import type { ComponentState } from '@continuum/contract';
import type { ContinuumComponentMap, ContinuumComponentProps } from '@continuum/react';

function TextInput({ value, onChange, definition }: ContinuumComponentProps) {
  const raw = value as Record<string, unknown> | undefined;
  const textValue = typeof raw?.['value'] === 'string' ? raw['value'] : '';

  return (
    <label style={{ display: 'grid', gap: 6 }}>
      <div>{definition.key ?? definition.id}</div>
      <input
        value={textValue as string}
        onChange={(e) => onChange({ value: e.target.value } as ComponentState)}
      />
    </label>
  );
}

function Select({ value, onChange, definition }: ContinuumComponentProps) {
  const raw = value as Record<string, unknown> | undefined;
  const selected = (raw?.['selectedIds'] as string[]) ?? [];

  return (
    <label style={{ display: 'grid', gap: 6 }}>
      <div>{definition.key ?? definition.id}</div>
      <select
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
    <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange({ checked: e.target.checked } as ComponentState)}
      />
      <span>{definition.key ?? definition.id}</span>
    </label>
  );
}

function Container({ definition, children }: ContinuumComponentProps) {
  return (
    <div style={{ padding: 12, border: '1px solid #ddd', borderRadius: 4 }}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>
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
