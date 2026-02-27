import type { ReconciliationTrace } from '@continuum/runtime';
import { radius, space, typeScale } from '../tokens';
import { playgroundTheme } from '../playground-theme';

interface TraceListProps {
  trace: ReconciliationTrace[];
}

export function TraceList({ trace }: TraceListProps) {
  if (trace.length === 0) {
    return <div style={{ ...typeScale.caption, color: playgroundTheme.color.soft }}>No trace available</div>;
  }

  return (
    <div style={{ display: 'grid', gap: space.xs }}>
      {trace.map((entry, index) => (
        <div
          key={`${entry.componentId}-${entry.action}-${index}`}
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
            <span style={{ ...typeScale.caption, color: playgroundTheme.color.text }}>{entry.componentId}</span>
            <span
              style={{
                ...typeScale.caption,
                color: tone(entry.action),
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {entry.action}
            </span>
          </div>
          {entry.matchedBy ? (
            <div style={{ ...typeScale.caption, color: playgroundTheme.color.soft }}>matched by {entry.matchedBy}</div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function tone(action: string): string {
  if (action === 'dropped') return playgroundTheme.color.danger;
  if (action === 'migrated') return playgroundTheme.color.warning;
  if (action === 'added') return playgroundTheme.color.success;
  return playgroundTheme.color.muted;
}

