import type { NodeValue } from '@continuum/core';
import type { ContinuumNodeProps } from './types.js';

/**
 * Default renderer used when no component exists for a node type.
 */
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
    <div data-continuum-fallback={definition.type} className="continuum-fallback">
      <div className="continuum-fallback-title">
        Unknown type: {definition.type} ({displayName})
      </div>
      <input
        value={textValue}
        onChange={(e) => onChange({ value: e.target.value } as NodeValue)}
        placeholder={placeholder}
        className="continuum-fallback-input"
      />
      <details className="continuum-fallback-details">
        <summary className="continuum-fallback-summary">
          Node definition
        </summary>
        <pre className="continuum-fallback-pre">
          {JSON.stringify(definition, null, 2)}
        </pre>
      </details>
    </div>
  );
}
