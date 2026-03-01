import { useEffect, useRef, useState } from 'react';
import type { ReconciliationResolution } from '@continuum/runtime';
import { radius, space, typeScale } from '../tokens';
import { playgroundTheme } from '../playground-theme';

interface ReconciliationToastProps {
  resolutions: ReconciliationResolution[];
}

export function ReconciliationToast({ resolutions }: ReconciliationToastProps) {
  const [visible, setVisible] = useState(false);
  const [summary, setSummary] = useState('');
  const previousResolutionsRef = useRef<ReconciliationResolution[]>([]);

  useEffect(() => {
    const changed =
      resolutions.length > 0 &&
      (resolutions.length !== previousResolutionsRef.current.length ||
        resolutions.some(
          (entry, index) =>
            entry.nodeId !== previousResolutionsRef.current[index]?.nodeId ||
            entry.resolution !== previousResolutionsRef.current[index]?.resolution
        ));

    previousResolutionsRef.current = resolutions;
    if (!changed) {
      return;
    }

    const counts: Record<string, number> = {};
    for (const entry of resolutions) {
      counts[entry.resolution] = (counts[entry.resolution] ?? 0) + 1;
    }

    const parts: string[] = [];
    if (counts['carried']) parts.push(`${counts['carried']} field${counts['carried'] > 1 ? 's' : ''} carried over`);
    if (counts['added']) parts.push(`${counts['added']} added`);
    if (counts['migrated']) parts.push(`${counts['migrated']} migrated`);
    if (counts['dropped']) parts.push(`${counts['dropped']} dropped`);

    setSummary(parts.join(', '));
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(timer);
  }, [resolutions]);

  if (!visible || !summary) {
    return null;
  }

  return (
    <div
      data-testid="reconciliation-toast"
      style={{
        position: 'fixed',
        left: '50%',
        bottom: 20,
        transform: 'translateX(-50%) translateY(0)',
        zIndex: 20,
        borderRadius: radius.lg,
        border: `1px solid ${playgroundTheme.color.border}`,
        background: playgroundTheme.color.surface,
        padding: `${space.sm}px ${space.xl}px`,
        color: playgroundTheme.color.text,
        boxShadow: playgroundTheme.shadow.panel,
        display: 'flex',
        gap: space.sm,
        alignItems: 'center',
        animation: 'reconciliation-toast-enter 0.3s ease-out',
      }}
    >
      <span style={{ ...typeScale.label, color: playgroundTheme.color.soft }}>Reconciled</span>
      <span style={typeScale.caption}>{summary}</span>
      <button
        onClick={() => setVisible(false)}
        style={{
          border: 'none',
          background: 'transparent',
          color: playgroundTheme.color.muted,
          cursor: 'pointer',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          ...typeScale.caption,
        }}
      >
        Close
      </button>
    </div>
  );
}
