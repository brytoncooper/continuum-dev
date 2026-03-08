import type { CSSProperties } from 'react';
import { color, radius, shadow, space, type } from '../tokens.js';

type ConflictBannerTone =
  | 'proposal'
  | 'accepted'
  | 'rejected'
  | 'overwritten'
  | 'stable'
  | 'missing';

const containerStyle = (
  tone: ConflictBannerTone,
  variant: 'card' | 'popover'
): CSSProperties => ({
  display: 'grid',
  gap: variant === 'popover' ? space.sm : space.md,
  padding: variant === 'popover' ? space.md : space.lg,
  borderRadius: radius.md,
  border: `1px solid ${tone === 'proposal' || tone === 'overwritten' ? color.borderStrong : color.borderSoft}`,
  background: color.surface,
  boxShadow: variant === 'popover' ? shadow.panel : undefined,
  minWidth: variant === 'popover' ? 260 : undefined,
  maxWidth: variant === 'popover' ? 320 : undefined,
});

const topRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: space.md,
  flexWrap: 'wrap',
};

const titleStyle: CSSProperties = {
  ...type.section,
  color: color.text,
};

const statusStyle: CSSProperties = {
  ...type.small,
  color: color.textMuted,
};

const valueGridStyle: CSSProperties = {
  display: 'grid',
  gap: space.sm,
};

const labelStyle: CSSProperties = {
  ...type.small,
  color: color.textSoft,
};

const valueStyle: CSSProperties = {
  ...type.body,
  color: color.text,
  wordBreak: 'break-word',
};

const actionsStyle: CSSProperties = {
  display: 'flex',
  gap: space.sm,
  flexWrap: 'wrap',
};

const popoverActionsStyle: CSSProperties = {
  ...actionsStyle,
  width: '100%',
  justifyContent: 'flex-end',
};

const buttonStyle: CSSProperties = {
  ...type.small,
  color: color.text,
  padding: `${space.sm}px ${space.md}px`,
  borderRadius: radius.pill,
  border: `1px solid ${color.border}`,
  background: color.surface,
  cursor: 'pointer',
};

function statusText(tone: ConflictBannerTone): string {
  switch (tone) {
    case 'proposal':
      return 'User value kept. AI suggestion pending.';
    case 'accepted':
      return 'AI suggestion accepted.';
    case 'rejected':
      return 'AI suggestion rejected.';
    case 'overwritten':
      return 'User value replaced directly.';
    case 'stable':
      return 'Field stayed unchanged.';
    default:
      return 'Field is not present in this step.';
  }
}

export function ConflictBanner({
  title,
  currentValue,
  currentLabel = 'Current value',
  nextValue,
  nextLabel = 'AI suggestion',
  tone,
  variant = 'card',
  onAccept,
  onReject,
}: {
  title: string;
  currentValue: string;
  currentLabel?: string;
  nextValue?: string;
  nextLabel?: string;
  tone: ConflictBannerTone;
  variant?: 'card' | 'popover';
  onAccept?: () => void;
  onReject?: () => void;
}) {
  if (variant === 'popover') {
    return (
      <div style={containerStyle(tone, variant)}>
        <div style={titleStyle}>{title}</div>
        <div style={valueStyle}>"{nextValue || 'Empty'}"</div>
        {onAccept && onReject ? (
          <div style={popoverActionsStyle}>
            <button type="button" style={buttonStyle} onClick={onAccept}>
              Accept
            </button>
            <button type="button" style={buttonStyle} onClick={onReject}>
              Reject
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div style={containerStyle(tone, variant)}>
      <div style={topRowStyle}>
        <div style={titleStyle}>{title}</div>
        <div style={statusStyle}>{statusText(tone)}</div>
      </div>
      <div style={valueGridStyle}>
        <div>
          <div style={labelStyle}>{currentLabel}</div>
          <div style={valueStyle}>{currentValue || 'Empty'}</div>
        </div>
        {nextValue !== undefined ? (
          <div>
            <div style={labelStyle}>{nextLabel}</div>
            <div style={valueStyle}>{nextValue || 'Empty'}</div>
          </div>
        ) : null}
      </div>
      {onAccept && onReject ? (
        <div style={actionsStyle}>
          <button type="button" style={buttonStyle} onClick={onAccept}>
            Accept
          </button>
          <button type="button" style={buttonStyle} onClick={onReject}>
            Reject
          </button>
        </div>
      ) : null}
    </div>
  );
}
