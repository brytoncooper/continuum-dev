import type { ContinuitySnapshot } from '@continuum/contract';
import { color, radius, space, typeScale } from '../tokens';

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
        border: `1px solid ${color.panelBorder}`,
        borderRadius: radius.md,
        background: color.panelSurfaceAlt,
        padding: space.sm,
        color: color.panelTextSecondary,
        ...typeScale.mono,
      }}
    >
      {JSON.stringify(snapshot, null, 2)}
    </pre>
  );
}

