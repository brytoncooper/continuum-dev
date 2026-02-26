import type { ReconciliationIssue } from '@continuum/runtime';
import { color, radius, space, typeScale } from '../tokens';

interface IssuesListProps {
  issues: ReconciliationIssue[];
}

export function IssuesList({ issues }: IssuesListProps) {
  if (issues.length === 0) {
    return <div style={{ ...typeScale.caption, color: color.panelTextMuted }}>Clean</div>;
  }

  return (
    <div style={{ display: 'grid', gap: space.xs }}>
      {issues.map((issue, index) => (
        <div
          key={`${issue.code}-${issue.componentId ?? 'global'}-${index}`}
          style={{
            border: `1px solid ${tone(issue.severity)}`,
            borderRadius: radius.md,
            background: background(issue.severity),
            padding: `${space.sm}px ${space.md}px`,
            display: 'grid',
            gap: space.xs,
          }}
        >
          <div style={{ ...typeScale.caption, color: tone(issue.severity) }}>
            {issue.code}
            {issue.componentId ? ` · ${issue.componentId}` : ''}
          </div>
          <div style={{ ...typeScale.caption, color: color.panelTextSecondary }}>{issue.message}</div>
        </div>
      ))}
    </div>
  );
}

function tone(severity: string): string {
  if (severity === 'error') return color.danger;
  if (severity === 'warning') return color.warning;
  return color.accent;
}

function background(severity: string): string {
  if (severity === 'error') return color.dangerBg;
  if (severity === 'warning') return color.warningBg;
  return color.infoBg;
}

