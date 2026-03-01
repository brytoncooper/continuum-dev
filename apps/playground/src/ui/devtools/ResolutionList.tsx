import type { ReconciliationResolution } from '@continuum/runtime';
import { radius, space, typeScale } from '../tokens';
import { playgroundTheme } from '../playground-theme';

interface ResolutionListProps {
  resolutions: ReconciliationResolution[];
}

export function ResolutionList({ resolutions }: ResolutionListProps) {
  if (resolutions.length === 0) {
    return <div style={{ ...typeScale.caption, color: playgroundTheme.color.soft }}>No resolutions available</div>;
  }

  return (
    <div style={{ display: 'grid', gap: space.xs }}>
      {resolutions.map((entry, index) => (
        <div
          key={`${entry.nodeId}-${entry.resolution}-${index}`}
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
            <span style={{ ...typeScale.caption, color: playgroundTheme.color.text }}>{entry.nodeId}</span>
            <span
              style={{
                ...typeScale.caption,
                color: tone(entry.resolution),
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {entry.resolution}
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

function tone(resolution: string): string {
  if (resolution === 'dropped') return playgroundTheme.color.danger;
  if (resolution === 'migrated') return playgroundTheme.color.warning;
  if (resolution === 'added') return playgroundTheme.color.success;
  return playgroundTheme.color.muted;
}
