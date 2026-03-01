import type { CSSProperties } from 'react';
import type { ViewNode, NodeValue } from '@continuum/contract';
import type { ContinuumNodeMap, ContinuumNodeProps } from '@continuum/react';
import { color, radius, shadow, space, typeScale } from './ui/tokens';

type Option = { id: string; label: string };

function attr<T = unknown>(node: ViewNode, key: string): T | undefined {
  return (node as unknown as Record<string, unknown>)[key] as T | undefined;
}

function nodeLabel(node: ViewNode): string {
  return attr<string>(node, 'label') ?? node.key ?? node.id ?? 'Field';
}

function nodeOptions(node: ViewNode): Option[] {
  const fromProps = attr<Record<string, unknown>>(node, 'props');
  if (Array.isArray(fromProps?.options)) return fromProps.options as Option[];
  const direct = attr<Option[]>(node, 'options');
  if (Array.isArray(direct)) return direct;
  return [];
}

function numProp(node: ViewNode, key: string, fallback: number): number {
  const fromProps = attr<Record<string, unknown>>(node, 'props');
  if (typeof fromProps?.[key] === 'number') return fromProps[key] as number;
  const fromConstraints = attr<Record<string, unknown>>(node, 'constraints');
  if (typeof fromConstraints?.[key] === 'number') return fromConstraints[key] as number;
  return fallback;
}

const FIELD: CSSProperties = {
  display: 'grid',
  gap: space.xs,
};

const LABEL: CSSProperties = {
  ...typeScale.caption,
  color: color.textSecondary,
  marginTop: 8,
};

const INPUT: CSSProperties = {
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

function TextInput({ value, onChange, definition }: ContinuumNodeProps) {
  const text = (value as NodeValue<string> | undefined)?.value ?? '';
  const lbl = nodeLabel(definition);
  const required = attr<Record<string, unknown>>(definition, 'constraints')?.required;

  return (
    <label className="continuum-field" style={FIELD}>
      <div style={LABEL}>
        {lbl}
        {required ? ' *' : ''}
      </div>
      <input
        style={INPUT}
        value={text}
        placeholder={attr<string>(definition, 'placeholder') ?? `Enter ${lbl}`}
        disabled={Boolean(attr(definition, 'disabled'))}
        readOnly={Boolean(attr(definition, 'readOnly'))}
        onChange={(e) => onChange({ value: e.target.value } as NodeValue)}
      />
    </label>
  );
}

function Select({ value, onChange, definition }: ContinuumNodeProps) {
  const selected = (value as NodeValue<string> | undefined)?.value ?? '';
  const options = nodeOptions(definition);
  const lbl = nodeLabel(definition);
  const required = attr<Record<string, unknown>>(definition, 'constraints')?.required;

  return (
    <label className="continuum-field" style={FIELD}>
      <div style={LABEL}>
        {lbl}
        {required ? ' *' : ''}
      </div>
      <select
        style={{
          ...INPUT,
          cursor: 'pointer',
          appearance: 'none',
          backgroundImage:
            'linear-gradient(45deg, transparent 50%, #8b97a8 50%), linear-gradient(135deg, #8b97a8 50%, transparent 50%)',
          backgroundPosition:
            'calc(100% - 16px) calc(50% - 3px), calc(100% - 10px) calc(50% - 3px)',
          backgroundSize: '6px 6px, 6px 6px',
          backgroundRepeat: 'no-repeat',
          paddingRight: 32,
        }}
        value={selected}
        disabled={Boolean(attr(definition, 'disabled')) || Boolean(attr(definition, 'readOnly'))}
        onChange={(e) => onChange({ value: e.target.value } as NodeValue)}
      >
        <option value="">Select one</option>
        {options.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Toggle({ value, onChange, definition }: ContinuumNodeProps) {
  const checked = Boolean((value as NodeValue<boolean> | undefined)?.value);
  const disabled = Boolean(attr(definition, 'disabled'));
  const readOnly = Boolean(attr(definition, 'readOnly'));

  return (
    <label
      className="continuum-field"
      style={{ display: 'flex', alignItems: 'center', gap: space.sm, cursor: 'pointer' }}
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
          onChange={(e) => {
            if (readOnly) return;
            onChange({ value: e.target.checked } as NodeValue);
          }}
          style={{ opacity: 0, position: 'absolute', inset: 0, cursor: 'pointer' }}
        />
      </span>
      <span style={{ ...typeScale.body, color: color.text }}>
        {nodeLabel(definition)}
      </span>
    </label>
  );
}

function DateInput({ value, onChange, definition }: ContinuumNodeProps) {
  const dateValue = (value as NodeValue<string> | undefined)?.value ?? '';
  const lbl = nodeLabel(definition);
  const required = attr<Record<string, unknown>>(definition, 'constraints')?.required;

  return (
    <label style={FIELD}>
      <div style={LABEL}>
        {lbl}
        {required ? ' *' : ''}
      </div>
      <input
        type="date"
        style={{ ...INPUT, cursor: 'pointer', appearance: 'auto', WebkitAppearance: 'auto' }}
        value={dateValue}
        disabled={Boolean(attr(definition, 'disabled'))}
        readOnly={Boolean(attr(definition, 'readOnly'))}
        onChange={(e) => onChange({ value: e.target.value } as NodeValue)}
        onClick={(e) => {
          const input = e.currentTarget;
          if (typeof input.showPicker === 'function') input.showPicker();
        }}
      />
    </label>
  );
}

function TextArea({ value, onChange, definition }: ContinuumNodeProps) {
  const text = (value as NodeValue<string> | undefined)?.value ?? '';
  const lbl = nodeLabel(definition);
  const required = attr<Record<string, unknown>>(definition, 'constraints')?.required;

  return (
    <label className="continuum-field" style={FIELD}>
      <div style={LABEL}>
        {lbl}
        {required ? ' *' : ''}
      </div>
      <textarea
        style={{ ...INPUT, minHeight: 92, height: 'auto', resize: 'vertical', fontFamily: 'inherit' }}
        value={text}
        placeholder={attr<string>(definition, 'placeholder') ?? `Enter ${lbl}`}
        disabled={Boolean(attr(definition, 'disabled'))}
        readOnly={Boolean(attr(definition, 'readOnly'))}
        onChange={(e) => onChange({ value: e.target.value } as NodeValue)}
      />
    </label>
  );
}

function RadioGroup({ value, onChange, definition }: ContinuumNodeProps) {
  const selected = (value as NodeValue<string> | undefined)?.value ?? '';
  const options = nodeOptions(definition);
  const lbl = nodeLabel(definition);
  const required = attr<Record<string, unknown>>(definition, 'constraints')?.required;

  return (
    <div style={FIELD}>
      <div style={LABEL}>
        {lbl}
        {required ? ' *' : ''}
      </div>
      <div style={{ display: 'grid', gap: space.sm }}>
        {options.map((opt) => (
          <label
            key={opt.id}
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
              checked={selected === opt.id}
              disabled={Boolean(attr(definition, 'disabled'))}
              onChange={() => {
                if (attr(definition, 'readOnly')) return;
                onChange({ value: opt.id } as NodeValue);
              }}
              style={{ accentColor: color.accent, width: 16, height: 16, cursor: 'pointer' }}
            />
            {opt.label}
          </label>
        ))}
      </div>
    </div>
  );
}

function Slider({ value, onChange, definition }: ContinuumNodeProps) {
  const min = numProp(definition, 'min', 0);
  const max = numProp(definition, 'max', 100);
  const midpoint = Math.round((min + max) / 2);
  const numericValue =
    typeof (value as NodeValue<number> | undefined)?.value === 'number'
      ? (value as NodeValue<number>).value
      : midpoint;
  const lbl = nodeLabel(definition);
  const required = attr<Record<string, unknown>>(definition, 'constraints')?.required;

  return (
    <label className="continuum-field" style={FIELD}>
      <div style={{ ...LABEL, display: 'flex', justifyContent: 'space-between' }}>
        <span>
          {lbl}
          {required ? ' *' : ''}
        </span>
        <span style={{ color: color.text }}>{numericValue}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={numericValue}
        disabled={Boolean(attr(definition, 'disabled'))}
        onChange={(e) => {
          if (attr(definition, 'readOnly')) return;
          onChange({ value: Number(e.target.value) } as NodeValue);
        }}
        style={{ width: '100%', accentColor: color.accent, cursor: 'pointer', height: 4 }}
      />
      <div style={{ ...typeScale.caption, color: color.textMuted }}>
        {min} &ndash; {max}
      </div>
    </label>
  );
}

function ActionButton({ onChange, definition }: ContinuumNodeProps) {
  const lbl = nodeLabel(definition);
  const disabled = Boolean(attr(definition, 'disabled'));

  return (
    <button
      className="continuum-field"
      disabled={disabled}
      onClick={() => onChange({ value: true } as NodeValue)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: space.sm,
        height: 40,
        padding: `${space.sm}px ${space.lg}px`,
        borderRadius: radius.sm,
        border: `1px solid ${color.accent}`,
        background: color.accent,
        color: color.white,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'background 0.2s ease, transform 0.1s ease',
        ...typeScale.body,
        fontWeight: 600,
      }}
    >
      {lbl}
    </button>
  );
}

function Section({ definition, children }: ContinuumNodeProps) {
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
        {nodeLabel(definition)}
      </div>
      <div style={{ display: 'grid', gap: space.lg }}>{children}</div>
    </div>
  );
}

function GroupFallback({ definition, children }: ContinuumNodeProps) {
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
      <div style={LABEL}>{nodeLabel(definition)}</div>
      <div style={{ display: 'grid', gap: space.md }}>{children}</div>
    </div>
  );
}

export const componentMap: ContinuumNodeMap = {
  field: TextInput,
  select: Select,
  toggle: Toggle,
  action: ActionButton,
  date: DateInput,
  textarea: TextArea,
  'radio-group': RadioGroup,
  slider: Slider,
  group: Section,
  default: GroupFallback,
};
