import type { ContinuitySnapshot } from '@continuum/contract';
import { radius, space, typeScale } from '../tokens';
import { playgroundTheme } from '../playground-theme';

interface SnapshotViewerProps {
  snapshot: ContinuitySnapshot | null;
}

export function SnapshotViewer({ snapshot }: SnapshotViewerProps) {
  return (
    <pre
      style={{
        margin: 0,
        maxHeight: 320,
        overflow: 'auto',
        border: `1px solid ${playgroundTheme.color.border}`,
        borderRadius: radius.md,
        background: playgroundTheme.color.surfaceMuted,
        padding: space.sm,
        color: playgroundTheme.color.soft,
        fontFamily: playgroundTheme.type.mono,
        ...typeScale.mono,
      }}
    >
      {JSON.stringify(snapshot, null, 2)}
    </pre>
  );
}

