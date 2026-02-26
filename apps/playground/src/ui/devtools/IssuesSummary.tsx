import type { ReconciliationIssue } from '@continuum/runtime';
import { color, radius, space, typeScale } from '../tokens';

interface IssuesSummaryProps {
  issues: ReconciliationIssue[];
}

export function IssuesSummary({ issues }: IssuesSummaryProps) {
  const errors = issues.filter((issue) => issue.severity === 'error').length;
  const warnings = issues.filter((issue) => issue.severity === 'warning').length;
  const infos = issues.filter((issue) => issue.severity === 'info').length;

  if (issues.length === 0) {
    return <div style={{ ...typeScale.caption, color: color.panelTextMuted }}>No issues</div>;
  }

  return (
    <div style={{ display: 'flex', gap: space.xs, flexWrap: 'wrap' }}>
      {errors > 0 ? <Badge label={`${errors} error${errors > 1 ? 's' : ''}`} tone="danger" /> : null}
      {warnings > 0 ? <Badge label={`${warnings} warning${warnings > 1 ? 's' : ''}`} tone="warning" /> : null}
      {infos > 0 ? <Badge label={`${infos} info`} tone="info" /> : null}
    </div>
  );
}

function Badge({ label, tone }: { label: string; tone: 'danger' | 'warning' | 'info' }) {
  const background =
    tone === 'danger' ? color.dangerBg : tone === 'warning' ? color.warningBg : color.infoBg;
  const foreground =
    tone === 'danger' ? color.danger : tone === 'warning' ? color.warning : color.accent;

  return (
    <span
      style={{
        ...typeScale.caption,
        color: foreground,
        background,
        border: `1px solid ${foreground}`,
        borderRadius: radius.pill,
        padding: `${space.xs}px ${space.sm}px`,
      }}
    >
      {label}
    </span>
  );
}

