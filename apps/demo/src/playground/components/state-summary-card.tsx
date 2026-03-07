import type { CSSProperties } from 'react';
import { color, radius, space, type } from '../../ui/tokens';

const cardStyle: CSSProperties = {
  display: 'grid',
  gap: space.sm,
  padding: space.lg,
  borderRadius: radius.md,
  border: `1px solid ${color.borderSoft}`,
  background: color.surfaceMuted,
};

const titleStyle: CSSProperties = {
  ...type.label,
  color: color.textSoft,
};

const rowStyle: CSSProperties = {
  display: 'grid',
  gap: space.xs,
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

export function StateSummaryCard({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ label: string; value: string }>;
}) {
  return (
    <div style={cardStyle}>
      <div style={titleStyle}>{title}</div>
      {rows.map((row) => (
        <div key={row.label} style={rowStyle}>
          <div style={labelStyle}>{row.label}</div>
          <div style={valueStyle}>{row.value}</div>
        </div>
      ))}
    </div>
  );
}
