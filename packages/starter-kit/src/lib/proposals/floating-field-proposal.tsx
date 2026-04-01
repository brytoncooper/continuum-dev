import type { CSSProperties, ReactElement, ReactNode } from 'react';
import { color, radius, shadow, space, type as typography } from '../tokens.js';

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  return typeof value === 'string' ? value : String(value);
}

function truncate(text: string, max: number): string {
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, Math.max(0, max - 1))}…`;
}

const shellStyle: CSSProperties = {
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: space.sm,
  maxWidth: 'min(320px, calc(100vw - 32px))',
  padding: `${space.xs}px ${space.sm}px`,
  borderRadius: radius.md,
  border: `1px solid ${color.border}`,
  background: color.surface,
  boxShadow: `0 4px 24px rgba(17, 17, 17, 0.12), ${shadow.panel}`,
  pointerEvents: 'auto',
};

const badgeStyle: CSSProperties = {
  ...typography.small,
  flexShrink: 0,
  padding: `2px ${space.xs}px`,
  borderRadius: radius.sm,
  background: color.surfaceInset,
  color: color.textSoft,
  fontWeight: 600,
  letterSpacing: '0.04em',
  textTransform: 'uppercase' as const,
  fontSize: 10,
  lineHeight: 1.2,
};

const previewStyle: CSSProperties = {
  ...typography.small,
  color: color.text,
  minWidth: 0,
  flex: '1 1 120px',
  wordBreak: 'break-word' as const,
};

const actionsStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: space.xs,
  flexShrink: 0,
  marginLeft: 'auto',
};

function actionButtonStyle(tone: 'accept' | 'reject'): CSSProperties {
  return {
    boxSizing: 'border-box' as const,
    minHeight: 28,
    padding: `0 ${space.sm}px`,
    borderRadius: radius.sm,
    border:
      tone === 'accept'
        ? `1px solid ${color.borderStrong}`
        : `1px solid ${color.borderSoft}`,
    background: tone === 'accept' ? color.borderStrong : color.surface,
    color: tone === 'accept' ? color.surface : color.textMuted,
    cursor: 'pointer',
    fontFamily: 'inherit',
    ...typography.small,
    fontWeight: 600,
  };
}

/**
 * Compact accept/reject UI for a field suggestion, intended for absolutely
 * positioned overlays so it does not affect layout height.
 */
export function FloatingFieldProposal({
  hasSuggestion,
  suggestionValue,
  onAccept,
  onReject,
  badgeLabel = 'AI',
  previewLabel,
}: {
  hasSuggestion: boolean;
  suggestionValue: unknown;
  onAccept: () => void;
  onReject: () => void;
  badgeLabel?: string;
  previewLabel?: ReactNode;
}): ReactElement | null {
  if (!hasSuggestion) {
    return null;
  }

  const next = stringifyValue(suggestionValue);
  const preview =
    previewLabel ??
    truncate(next.length > 0 ? next : '(empty suggestion)', 72);

  return (
    <div
      role="group"
      aria-label="AI suggestion for this field"
      style={shellStyle}
    >
      <span style={badgeStyle}>{badgeLabel}</span>
      <span style={previewStyle}>{preview}</span>
      <div style={actionsStyle}>
        <button
          type="button"
          style={actionButtonStyle('accept')}
          onClick={onAccept}
        >
          Use
        </button>
        <button
          type="button"
          style={actionButtonStyle('reject')}
          onClick={onReject}
        >
          Ignore
        </button>
      </div>
    </div>
  );
}
