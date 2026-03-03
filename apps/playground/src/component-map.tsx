import type { CSSProperties } from 'react';
import type { ViewNode, NodeValue } from '@continuum/contract';
import { useContinuumSession, type ContinuumNodeMap, type ContinuumNodeProps } from '@continuum/react';
import { color, radius, shadow, space, transition, typeScale } from './ui/tokens';

type Option = { value: string; label: string };

function attr<T = unknown>(node: ViewNode, key: string): T | undefined {
  return (node as unknown as Record<string, unknown>)[key] as T | undefined;
}

function nodeLabel(node: ViewNode): string {
  return attr<string>(node, 'label') ?? node.key ?? node.id ?? 'Field';
}

function nodeOptions(node: ViewNode): Option[] {
  const fromProps = attr<Record<string, unknown>>(node, 'props');
  if (Array.isArray(fromProps?.options)) {
    return (fromProps.options as Array<Record<string, unknown>>)
      .map((option) => ({
        value: String(option.value ?? option.id ?? ''),
        label: String(option.label ?? option.value ?? option.id ?? ''),
      }))
      .filter((option) => option.value.length > 0);
  }
  const direct = attr<Option[]>(node, 'options');
  if (Array.isArray(direct)) {
    return (direct as Array<Record<string, unknown>>)
      .map((option) => ({
        value: String(option.value ?? option.id ?? ''),
        label: String(option.label ?? option.value ?? option.id ?? ''),
      }))
      .filter((option) => option.value.length > 0);
  }
  return [];
}

function numProp(node: ViewNode, key: string, fallback: number): number {
  const fromProps = attr<Record<string, unknown>>(node, 'props');
  if (typeof fromProps?.[key] === 'number') return fromProps[key] as number;
  const fromConstraints = attr<Record<string, unknown>>(node, 'constraints');
  if (typeof fromConstraints?.[key] === 'number') return fromConstraints[key] as number;
  return fallback;
}

function stringProp(node: ViewNode, key: string): string | undefined {
  const fromProps = attr<Record<string, unknown>>(node, 'props');
  if (typeof fromProps?.[key] === 'string') return fromProps[key] as string;
  const fromConstraints = attr<Record<string, unknown>>(node, 'constraints');
  if (typeof fromConstraints?.[key] === 'string') return fromConstraints[key] as string;
  return undefined;
}

function boolConstraint(node: ViewNode, key: string): boolean {
  const constraints = attr<Record<string, unknown>>(node, 'constraints');
  return Boolean(constraints?.[key]);
}

function isDateLikeField(node: ViewNode): boolean {
  const inputType = stringProp(node, 'inputType');
  if (inputType === 'date') return true;

  const id = node.id.toLowerCase();
  const key = (node.key ?? '').toLowerCase();
  const label = (nodeLabel(node) ?? '').toLowerCase();
  return (
    id.includes('date') ||
    key.includes('date') ||
    label.includes('date') ||
    label.includes('start') ||
    label.includes('end')
  );
}

function getValidationError(node: ViewNode, raw: unknown): string | null {
  const required = boolConstraint(node, 'required');
  const min = numProp(node, 'min', Number.NaN);
  const max = numProp(node, 'max', Number.NaN);
  const minLength = numProp(node, 'minLength', Number.NaN);
  const maxLength = numProp(node, 'maxLength', Number.NaN);
  const pattern = stringProp(node, 'pattern');

  if (required) {
    if (raw === null || raw === undefined || raw === '') {
      return 'This field is required';
    }
  }

  if (typeof raw === 'string') {
    if (!Number.isNaN(minLength) && raw.length < minLength) {
      return `Minimum length is ${minLength}`;
    }
    if (!Number.isNaN(maxLength) && raw.length > maxLength) {
      return `Maximum length is ${maxLength}`;
    }
    if (pattern) {
      try {
        const regex = new RegExp(pattern);
        if (raw && !regex.test(raw)) {
          return 'Invalid format';
        }
      } catch {
        return null;
      }
    }
  }

  if (typeof raw === 'number') {
    if (!Number.isNaN(min) && raw < min) {
      return `Minimum value is ${min}`;
    }
    if (!Number.isNaN(max) && raw > max) {
      return `Maximum value is ${max}`;
    }
  }

  return null;
}

const FIELD: CSSProperties = {
  display: 'grid',
  gap: space.sm,
};

const LABEL: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: '0.01em',
  color: color.textSecondary,
  lineHeight: 1.4,
};

const INPUT: CSSProperties = {
  width: '100%',
  height: 42,
  padding: '10px 14px',
  borderRadius: radius.md,
  border: `1px solid ${color.border}`,
  background: color.surface,
  color: color.text,
  outline: 'none',
  boxSizing: 'border-box',
  transition: `border-color ${transition.normal}, box-shadow ${transition.normal}, background ${transition.normal}`,
  ...typeScale.body,
};

const ERROR_TEXT: CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  color: color.danger,
  paddingLeft: 2,
};

function inputWithValidation(style: CSSProperties, error: string | null): CSSProperties {
  if (!error) return style;
  return {
    ...style,
    border: `1px solid ${color.danger}`,
    boxShadow: `0 0 0 2px ${color.danger}22`,
  };
}

function TextInput({ value, onChange, definition }: ContinuumNodeProps) {
  const text = (value as NodeValue<string | number | boolean> | undefined)?.value;
  const dataType = attr<string>(definition, 'dataType') ?? 'string';
  const options = nodeOptions(definition);
  const lbl = nodeLabel(definition);
  const required = attr<Record<string, unknown>>(definition, 'constraints')?.required;
  const error = getValidationError(definition, text ?? '');

  if (options.length > 0) {
    const selectedValue = typeof text === 'string' ? text : '';
    return (
      <label className="continuum-field" style={FIELD}>
        <div style={LABEL}>
          {lbl}
          {required ? ' *' : ''}
        </div>
        <select
          style={inputWithValidation(
            {
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
            },
            error
          )}
          value={selectedValue}
          disabled={Boolean(attr(definition, 'disabled')) || Boolean(attr(definition, 'readOnly'))}
          onChange={(event) => onChange({ value: event.target.value, isDirty: true } as NodeValue)}
        >
          <option value="">Select one</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error ? <div style={ERROR_TEXT}>{error}</div> : null}
      </label>
    );
  }

  if (dataType === 'boolean') {
    const checked = Boolean(text);
    return (
      <label className="continuum-field" style={{ display: 'flex', alignItems: 'center', gap: space.sm }}>
        <input
          type="checkbox"
          checked={checked}
          disabled={Boolean(attr(definition, 'disabled'))}
          onChange={(event) => {
            if (attr(definition, 'readOnly')) return;
            onChange({ value: event.target.checked, isDirty: true } as NodeValue);
          }}
        />
        <span style={LABEL}>
          {lbl}
          {required ? ' *' : ''}
        </span>
      </label>
    );
  }

  const inputType = dataType === 'number' ? 'number' : 'text';
  const displayValue =
    dataType === 'number' ? (typeof text === 'number' ? String(text) : '') : (typeof text === 'string' ? text : '');
  const isDate = isDateLikeField(definition) && dataType === 'string';

  if (isDate) {
    return (
      <label className="continuum-field" style={FIELD}>
        <div style={LABEL}>
          {lbl}
          {required ? ' *' : ''}
        </div>
        <input
          type="date"
          style={inputWithValidation(
            { ...INPUT, cursor: 'pointer', appearance: 'auto', WebkitAppearance: 'auto' as never },
            error
          )}
          value={typeof text === 'string' ? text : ''}
          disabled={Boolean(attr(definition, 'disabled'))}
          readOnly={Boolean(attr(definition, 'readOnly'))}
          onChange={(e) => onChange({ value: e.target.value, isDirty: true } as NodeValue)}
          onClick={(e) => {
            const input = e.currentTarget;
            if (typeof input.showPicker === 'function') input.showPicker();
          }}
        />
        {error ? <div style={ERROR_TEXT}>{error}</div> : null}
      </label>
    );
  }

  return (
    <label className="continuum-field" style={FIELD}>
      <div style={LABEL}>
        {lbl}
        {required ? ' *' : ''}
      </div>
      <input
        type={inputType}
        style={inputWithValidation(INPUT, error)}
        value={displayValue}
        placeholder={attr<string>(definition, 'placeholder') ?? `Enter ${lbl}`}
        disabled={Boolean(attr(definition, 'disabled'))}
        readOnly={Boolean(attr(definition, 'readOnly'))}
        onChange={(e) =>
          onChange({
            value: dataType === 'number' ? Number(e.target.value) : e.target.value, isDirty: true,
          } as NodeValue)
        }
      />
      {error ? <div style={ERROR_TEXT}>{error}</div> : null}
    </label>
  );
}

function Select({ value, onChange, definition }: ContinuumNodeProps) {
  const selected = (value as NodeValue<string> | undefined)?.value ?? '';
  const options = nodeOptions(definition);
  const lbl = nodeLabel(definition);
  const required = attr<Record<string, unknown>>(definition, 'constraints')?.required;
  const error = getValidationError(definition, selected);

  return (
    <label className="continuum-field" style={FIELD}>
      <div style={LABEL}>
        {lbl}
        {required ? ' *' : ''}
      </div>
      <select
        style={inputWithValidation({
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
        }, error)}
        value={selected}
        disabled={Boolean(attr(definition, 'disabled')) || Boolean(attr(definition, 'readOnly'))}
        onChange={(e) => onChange({ value: e.target.value, isDirty: true } as NodeValue)}
      >
        <option value="">Select one</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error ? <div style={ERROR_TEXT}>{error}</div> : null}
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
      style={{ display: 'flex', alignItems: 'center', gap: space.md, cursor: 'pointer', padding: `${space.xs}px 0` }}
    >
      <span
        style={{
          width: 48,
          height: 26,
          borderRadius: radius.pill,
          background: checked ? color.success : color.surfaceHover,
          border: `1px solid ${checked ? color.success : color.border}`,
          position: 'relative',
          transition: `background ${transition.normal}, border-color ${transition.normal}`,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 2,
            left: checked ? 23 : 2,
            width: 20,
            height: 20,
            borderRadius: radius.pill,
            background: color.white,
            boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
            transition: `left ${transition.normal}`,
          }}
        />
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => {
            if (readOnly) return;
            onChange({ value: e.target.checked, isDirty: true } as NodeValue);
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
  const error = getValidationError(definition, dateValue);

  return (
    <label style={FIELD}>
      <div style={LABEL}>
        {lbl}
        {required ? ' *' : ''}
      </div>
      <input
        type="date"
        style={inputWithValidation(
          { ...INPUT, cursor: 'pointer', appearance: 'auto', WebkitAppearance: 'auto' as never },
          error
        )}
        value={dateValue}
        disabled={Boolean(attr(definition, 'disabled'))}
        readOnly={Boolean(attr(definition, 'readOnly'))}
        onChange={(e) => onChange({ value: e.target.value, isDirty: true } as NodeValue)}
        onClick={(e) => {
          const input = e.currentTarget;
          if (typeof input.showPicker === 'function') input.showPicker();
        }}
      />
      {error ? <div style={ERROR_TEXT}>{error}</div> : null}
    </label>
  );
}

function TextArea({ value, onChange, definition }: ContinuumNodeProps) {
  const text = (value as NodeValue<string> | undefined)?.value ?? '';
  const lbl = nodeLabel(definition);
  const required = attr<Record<string, unknown>>(definition, 'constraints')?.required;
  const error = getValidationError(definition, text);

  return (
    <label className="continuum-field" style={FIELD}>
      <div style={LABEL}>
        {lbl}
        {required ? ' *' : ''}
      </div>
      <textarea
        style={inputWithValidation(
          { ...INPUT, minHeight: 92, height: 'auto', resize: 'vertical', fontFamily: 'inherit' },
          error
        )}
        value={text}
        placeholder={attr<string>(definition, 'placeholder') ?? `Enter ${lbl}`}
        disabled={Boolean(attr(definition, 'disabled'))}
        readOnly={Boolean(attr(definition, 'readOnly'))}
        onChange={(e) => onChange({ value: e.target.value, isDirty: true } as NodeValue)}
      />
      {error ? <div style={ERROR_TEXT}>{error}</div> : null}
    </label>
  );
}

function RadioGroup({ value, onChange, definition }: ContinuumNodeProps) {
  const selected = (value as NodeValue<string> | undefined)?.value ?? '';
  const options = nodeOptions(definition);
  const lbl = nodeLabel(definition);
  const required = attr<Record<string, unknown>>(definition, 'constraints')?.required;
  const error = getValidationError(definition, selected);

  return (
    <div style={FIELD}>
      <div style={LABEL}>
        {lbl}
        {required ? ' *' : ''}
      </div>
      <div style={{ display: 'grid', gap: 2 }}>
        {options.map((opt) => (
          <label
            key={opt.value}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: space.md,
              cursor: 'pointer',
              padding: `${space.sm}px ${space.sm}px`,
              borderRadius: radius.sm,
              transition: `background ${transition.fast}`,
              ...typeScale.body,
              color: color.text,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = color.surfaceAlt; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <input
              type="radio"
              name={definition.id}
              checked={selected === opt.value}
              disabled={Boolean(attr(definition, 'disabled'))}
              onChange={() => {
                if (attr(definition, 'readOnly')) return;
                onChange({ value: opt.value, isDirty: true } as NodeValue);
              }}
              style={{ accentColor: color.accent, width: 18, height: 18, cursor: 'pointer', flexShrink: 0 }}
            />
            {opt.label}
          </label>
        ))}
      </div>
      {error ? <div style={ERROR_TEXT}>{error}</div> : null}
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
  const error = getValidationError(definition, numericValue);

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
          onChange({ value: Number(e.target.value), isDirty: true } as NodeValue);
        }}
        style={{ width: '100%', accentColor: color.accent, cursor: 'pointer', height: 6 }}
      />
      <div style={{ ...typeScale.caption, color: color.textMuted }}>
        {min} &ndash; {max}
      </div>
      {error ? <div style={ERROR_TEXT}>{error}</div> : null}
    </label>
  );
}

function ActionButton({ onChange, definition }: ContinuumNodeProps) {
  const lbl = nodeLabel(definition);
  const disabled = Boolean(attr(definition, 'disabled'));
  const intentId = attr<string>(definition, 'intentId') ?? '';
  const session = useContinuumSession();

  return (
    <button
      className="continuum-field"
      disabled={disabled}
      onClick={() => {
        onChange({ value: true, isDirty: true } as NodeValue);
        if (intentId) {
          void session.dispatchAction(intentId, definition.id);
        }
      }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: space.sm,
        height: 42,
        padding: '10px 22px',
        borderRadius: radius.md,
        border: `1px solid ${color.accent}`,
        background: color.accent,
        color: color.white,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: `background ${transition.normal}, transform ${transition.fast}, box-shadow ${transition.normal}`,
        ...typeScale.body,
        fontWeight: 600,
      }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
    >
      {lbl}
    </button>
  );
}

function layoutStyles(definition: ViewNode): CSSProperties {
  const layout = attr<string>(definition, 'layout') ?? 'vertical';
  const cols = attr<number>(definition, 'columns') ?? 2;
  if (layout === 'horizontal') {
    return { display: 'flex', flexWrap: 'wrap', gap: space.lg, alignItems: 'flex-start' };
  }
  if (layout === 'grid') {
    return { display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: space.lg, alignItems: 'start' };
  }
  return { display: 'grid', gap: space.xl };
}

function Section({ definition, children }: ContinuumNodeProps) {
  return (
    <div
      style={{
        padding: space.xxl,
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
          marginBottom: space.xl,
          borderBottom: `1px solid ${color.border}`,
        }}
      >
        {nodeLabel(definition)}
      </div>
      <div style={layoutStyles(definition)}>{children}</div>
    </div>
  );
}

function RowSection({ definition, children }: ContinuumNodeProps) {
  return (
    <div style={{ display: 'flex', gap: space.lg, alignItems: 'center', flexWrap: 'wrap' }}>
      {children}
    </div>
  );
}

function GridSection({ definition, children }: ContinuumNodeProps) {
  const cols = attr<number>(definition, 'columns') ?? 2;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: space.lg, alignItems: 'start' }}>
      {children}
    </div>
  );
}

function CollectionSection({ definition, children }: ContinuumNodeProps) {
  return (
    <div
      style={{
        padding: space.xxl,
        borderRadius: radius.lg,
        background: color.surface,
        border: `1px dashed ${color.border}`,
        boxShadow: shadow.card,
        display: 'grid',
        gap: space.xl,
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
        padding: space.xl,
        border: `1px solid ${color.border}`,
        borderRadius: radius.lg,
        background: color.surfaceAlt,
        display: 'grid',
        gap: space.lg,
      }}
    >
      <div style={LABEL}>{nodeLabel(definition)}</div>
      <div style={layoutStyles(definition)}>{children}</div>
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
  row: RowSection,
  grid: GridSection,
  collection: CollectionSection,
  default: GroupFallback,
};
