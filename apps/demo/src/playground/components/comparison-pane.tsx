import type { CSSProperties, ReactNode } from 'react';
import { ExampleCard } from '../../ui/layout';
import { color, radius, space, type } from '../../ui/tokens';
import { StateSummaryCard } from './state-summary-card';
import { TechnicalDetails } from './technical-details';

const statusRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: space.md,
  flexWrap: 'wrap',
};

const statusChipStyle = (
  status: string,
  tone: 'naive' | 'continuum'
): CSSProperties => ({
  ...type.small,
  color: color.text,
  padding: `${space.sm}px ${space.md}px`,
  borderRadius: radius.pill,
  border: `1px solid ${
    tone === 'continuum'
      ? color.highlight
      : status === 'State dropped'
      ? color.danger
      : color.border
  }`,
  background:
    tone === 'continuum'
      ? color.highlightSoft
      : status === 'State dropped'
      ? color.dangerSoft
      : color.surface,
});

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: space.md,
};

const fullRowStyle: CSSProperties = {
  gridColumn: '1 / -1',
};

const explanationTitleStyle: CSSProperties = {
  ...type.label,
  color: color.textSoft,
};

const explanationBodyStyle: CSSProperties = {
  ...type.body,
  color: color.text,
};

const preStyle: CSSProperties = {
  ...type.small,
  color: color.text,
  margin: 0,
  padding: space.lg,
  borderRadius: radius.md,
  border: `1px solid ${color.borderSoft}`,
  background: color.surfaceMuted,
  overflowX: 'auto',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
};

const contentStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: space.lg,
  flex: 1,
  justifyContent: 'flex-start',
};

export function ComparisonPane({
  title,
  description,
  status,
  tone,
  semanticKey,
  currentNodeId,
  storedValue,
  values,
  children,
}: {
  title: string;
  description: string;
  status: string;
  tone: 'naive' | 'continuum';
  semanticKey: string;
  currentNodeId: string | null;
  storedValue: string;
  values: Record<string, unknown>;
  children: ReactNode;
}) {
  const previewStyle: CSSProperties = {
    padding: space.lg,
    borderRadius: radius.md,
    border: `1px solid ${
      tone === 'continuum' ? color.highlight : color.borderSoft
    }`,
    background: tone === 'continuum' ? color.highlightSoft : color.surfaceMuted,
    pointerEvents: 'none',
  };

  const explanationCardStyle: CSSProperties = {
    display: 'grid',
    gap: space.sm,
    padding: space.lg,
    borderRadius: radius.md,
    border: `1px solid ${
      tone === 'continuum' ? color.highlight : color.borderSoft
    }`,
    background: tone === 'continuum' ? color.surfaceAccent : color.surfaceMuted,
  };

  return (
    <ExampleCard title={title} description={description} span={6} fullHeight>
      <div style={contentStyle}>
        <div style={statusRowStyle}>
          <div style={statusChipStyle(status, tone)}>{status}</div>
        </div>
        <div style={previewStyle}>{children}</div>
        <div style={gridStyle}>
          <div style={fullRowStyle}>
            <div style={explanationCardStyle}>
              <div style={explanationTitleStyle}>
                Why this pane behaves this way
              </div>
              <div style={explanationBodyStyle}>
                {title === 'Without Continuum Reconciliation'
                  ? 'Values are attached only to current node ids.'
                  : 'The same view sequence is replayed through real Continuum reconciliation.'}
              </div>
            </div>
          </div>
          <div style={fullRowStyle}>
            <StateSummaryCard
              title="Tracked field"
              rows={[
                { label: 'Semantic key', value: semanticKey },
                {
                  label: 'Current node id',
                  value: currentNodeId ?? 'Not present in this view',
                },
                { label: 'Stored value', value: storedValue || 'Empty' },
              ]}
            />
          </div>
        </div>
        <TechnicalDetails summary="Show technical details">
          <pre style={preStyle}>{JSON.stringify(values, null, 2)}</pre>
        </TechnicalDetails>
      </div>
    </ExampleCard>
  );
}
