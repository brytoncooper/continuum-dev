import { useEffect, useMemo, useState } from 'react';
import type { ReconciliationResolution, StateDiff } from '@continuum/runtime';
import type { OutcomeHint, OutcomeSeverity } from '../../scenarios/types';
import { radius, space, typeScale } from '../tokens';
import { playgroundTheme } from '../playground-theme';

interface ValueCalloutProps {
  hint?: OutcomeHint;
  resolutions: ReconciliationResolution[];
  diffs: StateDiff[];
}

export function ValueCallout({ hint, resolutions, diffs }: ValueCalloutProps) {
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
    if (resolutions.some((entry) => entry.resolution === 'dropped')) {
      return 'danger';
    }
    if (diffs.some((diff) => diff.type === 'migrated' || diff.type === 'type-changed')) {
      return 'warning';
    }
    if (resolutions.length > 0) {
      return 'success';
    }
    return 'info';
  }, [hint, resolutions, diffs]);

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
      {hint.detail ? <div style={{ ...typeScale.caption, color: playgroundTheme.color.soft }}>{hint.detail}</div> : null}
    </div>
  );
}

const toneMap = {
  success: {
    background: playgroundTheme.color.successBg,
    border: playgroundTheme.color.success,
    accent: playgroundTheme.color.success,
    text: playgroundTheme.color.success,
  },
  warning: {
    background: playgroundTheme.color.warningBg,
    border: playgroundTheme.color.warning,
    accent: playgroundTheme.color.warning,
    text: playgroundTheme.color.warning,
  },
  danger: {
    background: playgroundTheme.color.dangerBg,
    border: playgroundTheme.color.danger,
    accent: playgroundTheme.color.danger,
    text: playgroundTheme.color.danger,
  },
  info: {
    background: playgroundTheme.color.infoBg,
    border: playgroundTheme.color.accent,
    accent: playgroundTheme.color.accent,
    text: playgroundTheme.color.accent,
  },
} as const;
