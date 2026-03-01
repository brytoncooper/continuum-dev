import type { DetachedValue } from '@continuum/contract';
import { radius, space, typeScale } from '../tokens';
import { playgroundTheme } from '../playground-theme';

interface DetachedListProps {
  detachedValues: Record<string, DetachedValue>;
}

function previewValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return '[unserializable]';
  }
}

export function DetachedList({ detachedValues }: DetachedListProps) {
  const entries = Object.entries(detachedValues);
  if (entries.length === 0) {
    return <div style={{ ...typeScale.caption, color: playgroundTheme.color.soft }}>No saved values</div>;
  }

  return (
    <div style={{ display: 'grid', gap: space.xs }}>
      {entries.map(([key, detached]) => (
        <div
          key={key}
          style={{
            border: `1px solid ${playgroundTheme.color.border}`,
            borderRadius: radius.md,
            background: playgroundTheme.color.surfaceMuted,
            padding: `${space.sm}px ${space.md}px`,
            display: 'grid',
            gap: space.xs,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: space.sm }}>
            <span style={{ ...typeScale.caption, color: playgroundTheme.color.text }}>{key}</span>
            <span style={{ ...typeScale.caption, color: playgroundTheme.color.warning }}>{detached.reason}</span>
          </div>
          <div style={{ ...typeScale.caption, color: playgroundTheme.color.soft }}>
            type: {detached.previousNodeType} · view: {detached.viewVersion}
          </div>
          <div style={{ ...typeScale.caption, color: playgroundTheme.color.muted }}>
            {previewValue(detached.value)}
          </div>
        </div>
      ))}
    </div>
  );
}
