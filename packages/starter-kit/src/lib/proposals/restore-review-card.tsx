import type { CSSProperties } from 'react';
import {
  starterKitDefaultStyles,
  useStarterKitStyle,
} from '../style-config.js';
import { color, radius, shadow, space, type } from '../tokens.js';
import type {
  RestoreReviewCandidateItem,
  RestoreReviewItem,
} from '../ai/session-workbench-model.js';
import { restoreReviewElementId } from './restore-review-utils.js';

const containerStyle: CSSProperties = {
  display: 'grid',
  gap: space.md,
  padding: space.lg,
  borderRadius: radius.md,
  border: `1px solid ${color.borderStrong}`,
  background: color.surface,
  boxShadow: shadow.panel,
};

const rowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: space.md,
  flexWrap: 'wrap',
};

const valueLabelStyle: CSSProperties = {
  ...type.small,
  color: color.textSoft,
};

const valueStyle: CSSProperties = {
  ...type.body,
  color: color.text,
  wordBreak: 'break-word',
};

const helperStyle: CSSProperties = {
  ...type.small,
  color: color.textMuted,
};

const candidateListStyle: CSSProperties = {
  display: 'grid',
  gap: space.sm,
};

const candidateRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: space.sm,
  flexWrap: 'wrap',
};

function candidateDescription(candidate: RestoreReviewCandidateItem): string {
  if (candidate.subtitle) {
    return `${candidate.title} in ${candidate.subtitle}`;
  }
  return candidate.title;
}

export function RestoreReviewCard({
  review,
  onApply,
  onRejectAll,
}: {
  review: RestoreReviewItem;
  onApply: (candidate: RestoreReviewCandidateItem) => void;
  onRejectAll: () => void;
}) {
  const buttonStyle = useStarterKitStyle(
    'conflictActionButton',
    starterKitDefaultStyles.conflictActionButton
  );

  return (
    <div id={restoreReviewElementId(review.reviewId)} style={containerStyle}>
      <div style={rowStyle}>
        <div style={{ display: 'grid', gap: space.xs }}>
          <div style={{ ...type.section, color: color.text }}>
            {review.title}
          </div>
          <div style={helperStyle}>
            {review.status === 'waiting'
              ? 'Waiting for possible matches in this scope.'
              : review.status === 'approved'
              ? `Approved for ${
                  review.approvedTargetLabel ?? 'a future matching field'
                }.`
              : 'Choose where this preserved value should go.'}
          </div>
        </div>
        <button type="button" style={buttonStyle} onClick={onRejectAll}>
          Reject all
        </button>
      </div>

      <div style={{ display: 'grid', gap: space.xs }}>
        <div style={valueLabelStyle}>Preserved value</div>
        <div style={valueStyle}>{review.valuePreview || 'Empty'}</div>
      </div>

      {review.status === 'candidates' ? (
        <div style={candidateListStyle}>
          {review.candidates.map((candidate) => (
            <div key={candidate.candidateId} style={candidateRowStyle}>
              <div style={helperStyle}>{candidateDescription(candidate)}</div>
              <button
                type="button"
                style={buttonStyle}
                onClick={() => {
                  onApply(candidate);
                }}
              >
                Apply here
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
