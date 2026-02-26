import type { ReactNode } from 'react';
import { color, space, typeScale } from '../tokens';

interface DevtoolsDockProps {
  summary: ReactNode;
  tracePanel: ReactNode;
  diffPanel: ReactNode;
  issuesPanel: ReactNode;
  snapshotPanel: ReactNode;
}

export function DevtoolsDock({
  summary,
  tracePanel,
  diffPanel,
  issuesPanel,
  snapshotPanel,
}: DevtoolsDockProps) {
  return (
    <div
      data-testid="devtools"
      style={{
        height: '100%',
        overflow: 'auto',
        padding: space.lg,
        display: 'grid',
        alignContent: 'start',
        gap: space.md,
        background: color.panelBg,
      }}
    >
      <div style={{ ...typeScale.label, color: color.panelTextMuted }}>Devtools</div>
      {summary}
      {tracePanel}
      {diffPanel}
      {issuesPanel}
      {snapshotPanel}
    </div>
  );
}

