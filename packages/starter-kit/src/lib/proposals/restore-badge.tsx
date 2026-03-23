import { useContinuumRestoreCandidates } from '@continuum-dev/react';
import type { CSSProperties } from 'react';
import { color, radius, space, type } from '../tokens.js';
import { restoreReviewElementId } from './restore-review-utils.js';

const badgeStyle: CSSProperties = {
  boxSizing: 'border-box',
  display: 'inline-flex',
  alignItems: 'center',
  gap: space.xs,
  minHeight: 24,
  padding: `0 ${space.sm}px`,
  borderRadius: radius.pill,
  border: `1px solid ${color.borderStrong}`,
  background: color.surfaceMuted,
  color: color.text,
  cursor: 'pointer',
  ...type.small,
};

export function StarterKitFieldRestoreBadge({ nodeId }: { nodeId?: string }) {
  const candidates = useContinuumRestoreCandidates(nodeId ?? '');

  if (!nodeId || candidates.length === 0) {
    return null;
  }

  const firstReviewId = candidates[0]?.reviewId;
  const label =
    candidates.length === 1
      ? 'Possible restore'
      : `${candidates.length} restores`;

  return (
    <button
      type="button"
      style={badgeStyle}
      onClick={() => {
        if (!firstReviewId || typeof document === 'undefined') {
          return;
        }

        const element = document.getElementById(
          restoreReviewElementId(firstReviewId)
        );
        element?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }}
    >
      {label}
    </button>
  );
}
