import type { StateDiff } from '@continuum/runtime';
import { radius, space, typeScale } from '../tokens';
import { playgroundTheme } from '../playground-theme';

interface DiffListProps {
  diffs: StateDiff[];
}

export function DiffList({ diffs }: DiffListProps) {
  if (diffs.length === 0) {
    return <div style={{ ...typeScale.caption, color: playgroundTheme.color.soft }}>No diffs</div>;
  }

  return (
    <div style={{ display: 'grid', gap: space.xs }}>
      {diffs.map((diff, index) => (
        <div
          key={`${diff.componentId}-${diff.type}-${index}`}
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
            <span style={{ ...typeScale.caption, color: playgroundTheme.color.text }}>{diff.componentId}</span>
            <span
              style={{
                ...typeScale.caption,
                color: tone(diff.type),
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {diff.type}
            </span>
          </div>
          {diff.reason ? (
            <div style={{ ...typeScale.caption, color: playgroundTheme.color.soft }}>{diff.reason}</div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function tone(type: string): string {
  if (type === 'removed' || type === 'type-changed') return playgroundTheme.color.danger;
  if (type === 'migrated') return playgroundTheme.color.warning;
  if (type === 'added') return playgroundTheme.color.success;
  return playgroundTheme.color.muted;
}

