import type { StateDiff } from '@continuum/runtime';
import { color, radius, space, typeScale } from '../tokens';

interface DiffListProps {
  diffs: StateDiff[];
}

export function DiffList({ diffs }: DiffListProps) {
  if (diffs.length === 0) {
    return <div style={{ ...typeScale.caption, color: color.panelTextMuted }}>No diffs</div>;
  }

  return (
    <div style={{ display: 'grid', gap: space.xs }}>
      {diffs.map((diff, index) => (
        <div
          key={`${diff.componentId}-${diff.type}-${index}`}
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
            <span style={{ ...typeScale.caption, color: color.panelText }}>{diff.componentId}</span>
            <span style={{ ...typeScale.caption, color: tone(diff.type) }}>{diff.type}</span>
          </div>
          {diff.reason ? (
            <div style={{ ...typeScale.caption, color: color.panelTextMuted }}>{diff.reason}</div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function tone(type: string): string {
  if (type === 'removed' || type === 'type-changed') return color.danger;
  if (type === 'migrated') return color.warning;
  if (type === 'added') return color.success;
  return color.panelTextSecondary;
}

