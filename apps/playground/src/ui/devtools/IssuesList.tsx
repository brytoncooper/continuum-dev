import type { ReconciliationIssue } from '@continuum/runtime';
import { radius, space, typeScale } from '../tokens';
import { playgroundTheme } from '../playground-theme';

interface IssuesListProps {
  issues: ReconciliationIssue[];
}

export function IssuesList({ issues }: IssuesListProps) {
  if (issues.length === 0) {
    return <div style={{ ...typeScale.caption, color: playgroundTheme.color.soft }}>Clean</div>;
  }

  return (
    <div style={{ display: 'grid', gap: space.xs }}>
      {issues.map((issue, index) => (
        <div
          key={`${issue.code}-${issue.nodeId ?? 'global'}-${index}`}
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
            {issue.nodeId ? ` · ${issue.nodeId}` : ''}
          </div>
          <div style={{ ...typeScale.caption, color: playgroundTheme.color.soft }}>{issue.message}</div>
        </div>
      ))}
    </div>
  );
}

function tone(severity: string): string {
  if (severity === 'error') return playgroundTheme.color.danger;
  if (severity === 'warning') return playgroundTheme.color.warning;
  return playgroundTheme.color.accent;
}

function background(severity: string): string {
  if (severity === 'error') return playgroundTheme.color.dangerBg;
  if (severity === 'warning') return playgroundTheme.color.warningBg;
  return playgroundTheme.color.infoBg;
}
