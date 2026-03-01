import type { NodeValue } from '@continuum/contract';
import type { ContinuumNodeProps } from './types.js';

export function FallbackComponent({
  value,
  onChange,
  definition,
}: ContinuumNodeProps) {
  const raw = value as Record<string, unknown> | undefined;
  const textValue =
    typeof raw?.['value'] === 'string' || typeof raw?.['value'] === 'number'
      ? String(raw['value'])
      : '';

  const meta = definition as unknown as Record<string, unknown>;
  const displayName =
    (typeof meta['label'] === 'string' ? meta['label'] : null) ??
    definition.id;
  const placeholder =
    (typeof meta['placeholder'] === 'string' ? meta['placeholder'] : null) ??
    `Enter value for "${displayName}"`;

  return (
    <div
      style={{
        border: '2px dashed #d1242f',
        borderRadius: 6,
        padding: 12,
        background: '#fff8f8',
      }}
    >
      <div style={{ fontSize: 11, color: '#d1242f', fontWeight: 600 }}>
        Unknown type: {definition.type} ({displayName})
      </div>
      <input
        value={textValue}
        onChange={(e) => onChange({ value: e.target.value } as NodeValue)}
        placeholder={placeholder}
        style={{
          display: 'block',
          width: '100%',
          marginTop: 8,
          padding: '4px 8px',
          border: '1px solid #ccc',
          borderRadius: 4,
          boxSizing: 'border-box',
        }}
      />
      <details style={{ marginTop: 8 }}>
        <summary style={{ fontSize: 11, color: '#666', cursor: 'pointer' }}>
          Node definition
        </summary>
        <pre
          style={{
            fontSize: 10,
            overflow: 'auto',
            background: '#f5f5f5',
            padding: 8,
            borderRadius: 4,
            margin: '4px 0 0',
          }}
        >
          {JSON.stringify(definition, null, 2)}
        </pre>
      </details>
    </div>
  );
}
