import { useEffect, useMemo, useState } from 'react';
import type { ReconciliationTrace, StateDiff } from '@continuum/runtime';
import type { OutcomeHint, OutcomeSeverity } from '../../scenarios/types';
import { color, radius, space, typeScale } from '../tokens';

interface ValueCalloutProps {
  hint?: OutcomeHint;
  trace: ReconciliationTrace[];
  diffs: StateDiff[];
}

export function ValueCallout({ hint, trace, diffs }: ValueCalloutProps) {
  const [visible, setVisible] = useState(Boolean(hint));

  useEffect(() => {
    setVisible(Boolean(hint));
    if (!hint) {
      return;
    }
    const timer = setTimeout(() => setVisible(false), 8000);
    return () => clearTimeout(timer);
  }, [hint?.summary]);

  const computedSeverity = useMemo<OutcomeSeverity>(() => {
    if (hint) {
      return hint.severity;
    }
    if (trace.some((entry) => entry.action === 'dropped')) {
      return 'danger';
    }
    if (diffs.some((diff) => diff.type === 'migrated' || diff.type === 'type-changed')) {
      return 'warning';
    }
    if (trace.length > 0) {
      return 'success';
    }
    return 'info';
  }, [hint, trace, diffs]);

  if (!visible || !hint) {
    return null;
  }

  const tone = toneMap[computedSeverity];

  return (
    <div
      data-testid="value-callout"
      style={{
        borderRadius: radius.lg,
        border: `1px solid ${tone.border}`,
        background: tone.background,
        borderLeft: `3px solid ${tone.accent}`,
        padding: `${space.md}px ${space.lg}px`,
        display: 'grid',
        gap: space.xs,
      }}
    >
      <div style={{ ...typeScale.caption, color: tone.text }}>{hint.summary}</div>
      {hint.detail ? <div style={{ ...typeScale.caption, color: color.textSecondary }}>{hint.detail}</div> : null}
    </div>
  );
}

const toneMap = {
  success: {
    background: color.successBg,
    border: color.success,
    accent: color.success,
    text: color.success,
  },
  warning: {
    background: color.warningBg,
    border: color.warning,
    accent: color.warning,
    text: color.warning,
  },
  danger: {
    background: color.dangerBg,
    border: color.danger,
    accent: color.danger,
    text: color.danger,
  },
  info: {
    background: color.infoBg,
    border: color.accent,
    accent: color.accent,
    text: color.accent,
  },
} as const;

