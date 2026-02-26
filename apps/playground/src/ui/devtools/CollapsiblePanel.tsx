import type { ReactNode } from 'react';
import { color, space, typeScale } from '../tokens';

interface CollapsiblePanelProps {
  title: string;
  count?: number;
  testId: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function CollapsiblePanel({
  title,
  count,
  testId,
  defaultOpen = false,
  children,
}: CollapsiblePanelProps) {
  return (
    <details
      data-testid={testId}
      open={defaultOpen}
      style={{
        border: `1px solid ${color.panelBorder}`,
        borderRadius: 8,
        background: color.panelSurface,
        padding: `0 ${space.md}px`,
      }}
    >
      <summary
        style={{
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: space.sm,
          padding: `${space.sm}px 0`,
          ...typeScale.caption,
          color: color.panelText,
        }}
      >
        <span>{title}</span>
        {count !== undefined ? <span style={{ color: color.panelTextMuted }}>({count})</span> : null}
      </summary>
      <div style={{ paddingBottom: space.sm }}>{children}</div>
    </details>
  );
}

