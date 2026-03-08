import type { ReactElement } from 'react';
import type {
  ContinuumNodeMap,
  ContinuumNodeProps,
} from '@continuum-dev/starter-kit';
import type { NodeValue } from '@continuum-dev/contract';
import {
  DateInput,
  Presentation,
  SelectInput,
  TextInput,
  TextareaInput,
  inputLikeStyle,
  nodeDescription,
  nodeLabel,
  nodePlaceholder,
  readNodeProp,
} from '@continuum-dev/starter-kit';
import { color } from '../../ui/tokens';
import { componentMap } from '../../component-map';

export interface NodeHighlight {
  tone: 'error';
}

function errorInputStyle() {
  return {
    border: '2px solid #c62828',
    background: '#fff3f3',
    color: color.text,
  } as const;
}

function wrapFieldComponent(
  Component: (props: ContinuumNodeProps) => ReactElement
) {
  return function HighlightedComponent(props: ContinuumNodeProps) {
    const key = readNodeProp<string>(props.definition, 'key');
    const highlight = key ? activeHighlights[key] : undefined;

    if (!highlight) {
      return <Component {...props} />;
    }

    return <HighlightedControl {...props} />;
  };
}

let activeHighlights: Record<string, NodeHighlight> = {};

function HighlightedControl({
  value,
  onChange,
  definition,
  nodeId,
  children,
}: ContinuumNodeProps) {
  const nodeType = readNodeProp<string>(definition, 'type');
  const label = nodeLabel(definition);
  const description = nodeDescription(definition);

  if (nodeType === 'textarea') {
    const text = (value as NodeValue<string> | undefined)?.value ?? '';

    return (
      <label style={{ display: 'grid', gap: 8, minWidth: 0 }}>
        <div style={{ display: 'grid', gap: 4 }}>
          <span
            style={{
              fontSize: 12,
              lineHeight: 1.3,
              fontWeight: 600,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: color.textSoft,
            }}
          >
            {label}
          </span>
          {description ? (
            <span
              style={{
                fontSize: 12,
                lineHeight: 1.4,
                fontWeight: 500,
                color: color.textMuted,
              }}
            >
              {description}
            </span>
          ) : null}
        </div>
        <textarea
          value={text}
          placeholder={
            nodePlaceholder(definition) ?? `Enter ${label.toLowerCase()}`
          }
          style={inputLikeStyle({
            minHeight: 120,
            height: 120,
            resize: 'vertical',
            ...errorInputStyle(),
          })}
          onChange={(event) =>
            onChange({ value: event.target.value, isDirty: true } as NodeValue)
          }
        />
      </label>
    );
  }

  if (nodeType === 'select') {
    const selected = (value as NodeValue<string> | undefined)?.value ?? '';
    const options =
      readNodeProp<Array<{ value: string; label: string }>>(
        definition,
        'options'
      ) ?? [];

    return (
      <label style={{ display: 'grid', gap: 8, minWidth: 0 }}>
        <div style={{ display: 'grid', gap: 4 }}>
          <span
            style={{
              fontSize: 12,
              lineHeight: 1.3,
              fontWeight: 600,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: color.textSoft,
            }}
          >
            {label}
          </span>
          {description ? (
            <span
              style={{
                fontSize: 12,
                lineHeight: 1.4,
                fontWeight: 500,
                color: color.textMuted,
              }}
            >
              {description}
            </span>
          ) : null}
        </div>
        <select
          value={selected}
          style={inputLikeStyle({
            cursor: 'pointer',
            paddingRight: 40,
            ...errorInputStyle(),
          })}
          onChange={(event) =>
            onChange({ value: event.target.value, isDirty: true } as NodeValue)
          }
        >
          <option value="">Select one</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (nodeType === 'date') {
    const dateValue = (value as NodeValue<string> | undefined)?.value ?? '';

    return (
      <label style={{ display: 'grid', gap: 8, minWidth: 0 }}>
        <div style={{ display: 'grid', gap: 4 }}>
          <span
            style={{
              fontSize: 12,
              lineHeight: 1.3,
              fontWeight: 600,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: color.textSoft,
            }}
          >
            {label}
          </span>
          {description ? (
            <span
              style={{
                fontSize: 12,
                lineHeight: 1.4,
                fontWeight: 500,
                color: color.textMuted,
              }}
            >
              {description}
            </span>
          ) : null}
        </div>
        <input
          type="date"
          value={dateValue}
          style={inputLikeStyle(errorInputStyle())}
          onChange={(event) =>
            onChange({ value: event.target.value, isDirty: true } as NodeValue)
          }
        />
      </label>
    );
  }

  if (nodeType === 'presentation') {
    return (
      <div
        style={{
          border: '2px solid #c62828',
          background: '#fff3f3',
          borderRadius: 12,
          padding: 12,
        }}
      >
        <Presentation
          definition={definition}
          nodeId={nodeId}
          value={value}
          onChange={onChange}
        >
          {children}
        </Presentation>
      </div>
    );
  }

  const dataType = readNodeProp<string>(definition, 'dataType') ?? 'string';
  const rawValue = (value as NodeValue<string | number> | undefined)?.value;
  const displayValue =
    dataType === 'number'
      ? typeof rawValue === 'number'
        ? String(rawValue)
        : ''
      : typeof rawValue === 'string'
      ? rawValue
      : '';

  return (
    <label style={{ display: 'grid', gap: 8, minWidth: 0 }}>
      <div style={{ display: 'grid', gap: 4 }}>
        <span
          style={{
            fontSize: 12,
            lineHeight: 1.3,
            fontWeight: 600,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: color.textSoft,
          }}
        >
          {label}
        </span>
        {description ? (
          <span
            style={{
              fontSize: 12,
              lineHeight: 1.4,
              fontWeight: 500,
              color: color.textMuted,
            }}
          >
            {description}
          </span>
        ) : null}
      </div>
      <input
        type={dataType === 'number' ? 'number' : 'text'}
        value={displayValue}
        placeholder={
          nodePlaceholder(definition) ?? `Enter ${label.toLowerCase()}`
        }
        readOnly={Boolean(readNodeProp<boolean>(definition, 'readOnly'))}
        style={inputLikeStyle(errorInputStyle())}
        onChange={(event) =>
          onChange({
            value:
              dataType === 'number'
                ? Number(event.target.value)
                : event.target.value,
            isDirty: true,
          } as NodeValue)
        }
      />
    </label>
  );
}

export function createHighlightedComponentMap(
  highlights: Record<string, NodeHighlight>,
  baseMap: ContinuumNodeMap = componentMap
): ContinuumNodeMap {
  activeHighlights = highlights;

  return {
    ...baseMap,
    field: wrapFieldComponent(TextInput),
    textarea: wrapFieldComponent(TextareaInput),
    presentation: wrapFieldComponent(Presentation),
    select: wrapFieldComponent(SelectInput),
    date: wrapFieldComponent(DateInput),
  };
}
