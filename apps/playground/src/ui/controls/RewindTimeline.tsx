import type { Checkpoint } from '@continuum/contract';
import { color, radius, space, typeScale } from '../tokens';

interface RewindTimelineProps {
  checkpoints: Checkpoint[];
  onRewind: (id: string) => void;
}

export function RewindTimeline({ checkpoints, onRewind }: RewindTimelineProps) {
  if (checkpoints.length === 0) {
    return null;
  }

  return (
    <div
      data-testid="rewind-timeline"
      style={{
        padding: `${space.md}px ${space.lg}px`,
        background: color.surfaceAlt,
        borderRadius: radius.lg,
        border: `1px solid ${color.border}`,
        display: 'flex',
        alignItems: 'center',
        gap: space.sm,
        overflow: 'auto',
      }}
    >
      <span style={{ ...typeScale.caption, color: color.textMuted }}>Rewind</span>
      {checkpoints.map((checkpoint, index) => (
        <button
          key={checkpoint.id}
          data-testid={`rewind-${index}`}
          onClick={() => onRewind(checkpoint.id)}
          style={{
            width: 28,
            height: 28,
            borderRadius: radius.pill,
            border: `1px solid ${color.border}`,
            background: color.surface,
            color: color.text,
            cursor: 'pointer',
            ...typeScale.caption,
          }}
          title={`Rewind to ${checkpoint.snapshot.schema.version}`}
        >
          {index + 1}
        </button>
      ))}
    </div>
  );
}

