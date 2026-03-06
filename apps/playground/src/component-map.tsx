import type { CSSProperties, ComponentType } from 'react';
import { getChildNodes, type ViewNode, type NodeValue } from '@continuum/contract';
import {
  useContinuumAction,
  type ContinuumNodeMap,
  type ContinuumNodeProps,
} from '@continuum/react';
import { color, radius, space, transition, typeScale } from './ui/tokens';

const fc = {
  text: '#09090b',
  label: '#3f3f46',
  muted: '#71717a',
  border: '#d4d4d8',
  borderSubtle: '#e4e4e7',
  surface: '#ffffff',
  surfaceMuted: '#fafafa',
  hover: '#f4f4f5',
  primary: '#18181b',
  primaryHover: '#27272a',
  arrow: '#71717a',
} as const;

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
  color: fc.label,
  lineHeight: 1.4,
};

const INPUT: CSSProperties = {
  width: '100%',
  height: 42,
  padding: '10px 14px',
  borderRadius: radius.md,
  border: `1px solid ${fc.border}`,
  background: fc.surface,
  color: fc.text,
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

const CONFLICT_WRAP: CSSProperties = {
  display: 'grid',
  gap: space.sm,
};

const CONFLICT_BOX: CSSProperties = {
  display: 'grid',
  gap: space.sm,
  padding: `${space.sm}px ${space.md}px`,
  borderRadius: radius.md,
  border: `1px solid ${color.warning}`,
  background: `${color.warning}10`,
};

const CONFLICT_TEXT: CSSProperties = {
  ...typeScale.caption,
  color: color.text,
};

const CONFLICT_ACTIONS: CSSProperties = {
  display: 'flex',
  gap: space.sm,
};

const ACCEPT_BUTTON: CSSProperties = {
  height: 30,
  padding: `0 ${space.md}px`,
  borderRadius: radius.sm,
  border: `1px solid ${color.success}`,
  background: color.success,
  color: color.white,
  cursor: 'pointer',
  ...typeScale.caption,
  fontWeight: 600,
};

const REJECT_BUTTON: CSSProperties = {
  height: 30,
  padding: `0 ${space.md}px`,
  borderRadius: radius.sm,
  border: `1px solid ${color.border}`,
  background: color.surface,
  color: color.text,
  cursor: 'pointer',
  ...typeScale.caption,
  fontWeight: 600,
};

function layerDepth(nodeId?: string): number {
  if (!nodeId) return 0;
  return nodeId.split('/').length - 1;
}

function layerStyle(nodeId?: string): CSSProperties {
  const depth = layerDepth(nodeId);

  if (depth === 0) {
    return {
      padding: space.xxl,
      borderRadius: radius.lg,
      background: fc.surface,
      border: `1px solid ${fc.border}`,
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
    };
  }

  return {};
}

function inputWithValidation(style: CSSProperties, error: string | null): CSSProperties {
  if (!error) return style;
  return {
    ...style,
    border: `1px solid ${color.danger}`,
    boxShadow: `0 0 0 2px ${color.danger}22`,
  };
}

function formatProposalValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value === null || value === undefined) return 'empty';
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function withSuggestionResolution(
  Component: ComponentType<ContinuumNodeProps>
): ComponentType<ContinuumNodeProps> {
  return function SuggestionAwareComponent(props: ContinuumNodeProps) {
    const valueObj = props.value as NodeValue | undefined;
    const hasSuggestion = valueObj && 'suggestion' in valueObj && valueObj.suggestion !== undefined;
    
    const accept = () => {
      if (!valueObj || !hasSuggestion) return;
      props.onChange({
        ...valueObj,
        value: valueObj.suggestion,
        suggestion: undefined,
        isDirty: true
      });
    };

    const reject = () => {
      if (!valueObj || !hasSuggestion) return;
      props.onChange({
        ...valueObj,
        suggestion: undefined
      });
    };

    return (
      <div style={CONFLICT_WRAP}>
        <Component {...props} />
        {hasSuggestion ? (
          <div style={CONFLICT_BOX}>
            <div style={CONFLICT_TEXT}>Suggested value: {formatProposalValue(valueObj.suggestion)}</div>
            <div style={CONFLICT_ACTIONS}>
              <button type="button" style={ACCEPT_BUTTON} onClick={accept}>
                Accept
              </button>
              <button type="button" style={REJECT_BUTTON} onClick={reject}>
                Reject
              </button>
            </div>
          </div>
        ) : null}
      </div>
    );
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
                `linear-gradient(45deg, transparent 50%, ${fc.arrow} 50%), linear-gradient(135deg, ${fc.arrow} 50%, transparent 50%)`,
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
            `linear-gradient(45deg, transparent 50%, ${fc.arrow} 50%), linear-gradient(135deg, ${fc.arrow} 50%, transparent 50%)`,
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
          background: checked ? fc.primary : fc.hover,
          border: `1px solid ${checked ? fc.primary : fc.border}`,
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
      <span style={{ ...typeScale.body, color: fc.text }}>
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
              color: fc.text,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = fc.hover; }}
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
              style={{ accentColor: fc.primary, width: 18, height: 18, cursor: 'pointer', flexShrink: 0 }}
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
        <span style={{ color: fc.text }}>{numericValue}</span>
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
        style={{ width: '100%', accentColor: fc.primary, cursor: 'pointer', height: 6 }}
      />
      <div style={{ ...typeScale.caption, color: fc.muted }}>
        {min} &ndash; {max}
      </div>
      {error ? <div style={ERROR_TEXT}>{error}</div> : null}
    </label>
  );
}

function Presentation({ definition }: ContinuumNodeProps) {
  const content = attr<string>(definition, 'content') ?? '';
  if (!content) return null;
  return (
    <div
      style={{
        ...typeScale.body,
      color: fc.label,
      lineHeight: 1.6,
      padding: `${space.xs}px 0`,
      }}
    >
      {content}
    </div>
  );
}

function ActionButton({ onChange, definition }: ContinuumNodeProps) {
  const lbl = nodeLabel(definition);
  const disabled = Boolean(attr(definition, 'disabled'));
  const intentId = attr<string>(definition, 'intentId') ?? '';
  const { dispatch, isDispatching, lastResult } = useContinuumAction(intentId);

  const busy = isDispatching || disabled;

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        width: '100%',
        marginLeft: 'auto',
        flex: '1 0 100%',
        gap: space.sm,
      }}
    >
      {lastResult && (
        <span style={{
          ...typeScale.caption,
          color: lastResult.success ? '#16a34a' : '#dc2626',
          fontWeight: 500,
        }}>
          {lastResult.success ? 'Done' : 'Failed'}
        </span>
      )}
      <button
        className="continuum-field"
        disabled={busy}
        onClick={async () => {
          onChange({ value: true, isDirty: true } as NodeValue);
          if (intentId) {
            await dispatch(definition.id);
          }
        }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: space.sm,
          height: 42,
          padding: '10px 24px',
          borderRadius: radius.md,
          border: `1px solid ${fc.primary}`,
          background: fc.primary,
          color: fc.surface,
          cursor: busy ? 'not-allowed' : 'pointer',
          opacity: busy ? 0.5 : 1,
          transition: `background ${transition.normal}, border-color ${transition.normal}, transform ${transition.fast}`,
          ...typeScale.body,
          fontWeight: 600,
          outline: 'none',
        }}
        onMouseEnter={(e) => { if (!busy) { e.currentTarget.style.background = fc.primaryHover; e.currentTarget.style.borderColor = fc.primaryHover; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
        onMouseLeave={(e) => { e.currentTarget.style.background = fc.primary; e.currentTarget.style.borderColor = fc.primary; e.currentTarget.style.transform = 'translateY(0)'; }}
      >
        {isDispatching ? 'Working...' : lbl}
      </button>
    </div>
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

function Section({ definition, children, nodeId }: ContinuumNodeProps) {
  const depth = layerDepth(nodeId);
  return (
    <div
      style={{
        ...layerStyle(nodeId),
        display: 'grid',
        gap: depth === 0 ? space.lg : space.md,
      }}
    >
      <div
        style={{
          ...(depth === 0 ? typeScale.h2 : depth === 1 ? typeScale.h3 : { ...typeScale.caption, fontWeight: 600 }),
          color: depth < 2 ? fc.text : fc.label,
          paddingBottom: depth === 0 ? space.sm : space.xs,
          borderBottom: `1px solid ${fc.borderSubtle}`,
        }}
      >
        {nodeLabel(definition)}
      </div>
      <div style={layoutStyles(definition)}>{children}</div>
    </div>
  );
}

function RowSection({ definition, children, nodeId }: ContinuumNodeProps) {
  const style = layerStyle(nodeId);
  const childDefs = getChildNodes(definition);
  const hasAction = childDefs.some((child) => child.type === 'action');
  return (
    <div
      style={{
        ...style,
        display: 'flex',
        gap: space.lg,
        alignItems: 'center',
        flexWrap: 'wrap',
        width: '100%',
        justifyContent: hasAction ? 'flex-end' : 'flex-start',
      }}
    >
      {children}
    </div>
  );
}

function GridSection({ definition, children, nodeId }: ContinuumNodeProps) {
  const cols = attr<number>(definition, 'columns') ?? 2;
  const style = layerStyle(nodeId);
  return (
    <div style={{ ...style, display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: space.lg, alignItems: 'start' }}>
      {children}
    </div>
  );
}

function CollectionSection({ definition, children, nodeId }: ContinuumNodeProps) {
  const depth = layerDepth(nodeId);
  return (
    <div
      style={{
        ...layerStyle(nodeId),
        display: 'grid',
        gap: depth === 0 ? space.lg : space.md,
      }}
    >
      <div
        style={{
          ...(depth === 0 ? typeScale.h2 : depth === 1 ? typeScale.h3 : { ...typeScale.caption, fontWeight: 600 }),
          color: depth < 2 ? fc.text : fc.label,
          paddingBottom: depth === 0 ? space.sm : space.xs,
          borderBottom: `1px solid ${fc.borderSubtle}`,
        }}
      >
        {nodeLabel(definition)}
      </div>
      <div style={{ display: 'grid', gap: space.md }}>{children}</div>
    </div>
  );
}

function GroupFallback({ definition, children, nodeId }: ContinuumNodeProps) {
  const style = layerStyle(nodeId);
  return (
    <div style={{ ...style, display: 'grid', gap: space.md }}>
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
  presentation: Presentation,
  group: Section,
  row: RowSection,
  grid: GridSection,
  collection: CollectionSection,
  default: GroupFallback,
};

export const liveAiComponentMap: ContinuumNodeMap = {
  ...componentMap,
  field: withSuggestionResolution(TextInput),
  select: withSuggestionResolution(Select),
  toggle: withSuggestionResolution(Toggle),
  date: withSuggestionResolution(DateInput),
  textarea: withSuggestionResolution(TextArea),
  'radio-group': withSuggestionResolution(RadioGroup),
  slider: withSuggestionResolution(Slider),
  collection: withSuggestionResolution(CollectionSection),
};
