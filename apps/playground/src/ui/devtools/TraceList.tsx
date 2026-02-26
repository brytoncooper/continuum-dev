import type { ReconciliationTrace } from '@continuum/runtime';
import { color, radius, space, typeScale } from '../tokens';

interface TraceListProps {
  trace: ReconciliationTrace[];
}

export function TraceList({ trace }: TraceListProps) {
  if (trace.length === 0) {
    return <div style={{ ...typeScale.caption, color: color.panelTextMuted }}>No trace available</div>;
  }

  return (
    <div style={{ display: 'grid', gap: space.xs }}>
      {trace.map((entry, index) => (
        <div
          key={`${entry.componentId}-${entry.action}-${index}`}
          style={{
            border: `1px solid ${color.panelBorder}`,
            borderRadius: radius.md,
            background: color.panelSurfaceAlt,
            padding: `${space.sm}px ${space.md}px`,
            display: 'grid',
            gap: space.xs,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: space.sm }}>
            <span style={{ ...typeScale.caption, color: color.panelText }}>{entry.componentId}</span>
            <span style={{ ...typeScale.caption, color: tone(entry.action) }}>{entry.action}</span>
          </div>
          {entry.matchedBy ? (
            <div style={{ ...typeScale.caption, color: color.panelTextMuted }}>matched by {entry.matchedBy}</div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function tone(action: string): string {
  if (action === 'dropped') return color.danger;
  if (action === 'migrated') return color.warning;
  if (action === 'added') return color.success;
  return color.panelTextSecondary;
}

