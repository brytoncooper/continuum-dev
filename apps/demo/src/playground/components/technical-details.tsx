import type { CSSProperties, ReactNode } from 'react';
import { color, radius, space, type } from '../../ui/tokens';

const detailsStyle: CSSProperties = {
  display: 'grid',
  gap: space.sm,
  borderRadius: radius.md,
  border: `1px solid ${color.borderSoft}`,
  background: color.surfaceMuted,
  padding: space.md,
};

const summaryStyle: CSSProperties = {
  ...type.small,
  color: color.text,
  cursor: 'pointer',
  listStyle: 'none',
};

export function TechnicalDetails({
  summary,
  children,
}: {
  summary: string;
  children: ReactNode;
}) {
  return (
    <details style={detailsStyle}>
      <summary style={summaryStyle}>{summary}</summary>
      {children}
    </details>
  );
}
