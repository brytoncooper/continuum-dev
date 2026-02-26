import { useEffect, useRef, useState } from 'react';
import type { ReconciliationTrace } from '@continuum/runtime';
import { color, radius, shadow, space, typeScale } from '../tokens';

interface ReconciliationToastProps {
  trace: ReconciliationTrace[];
}

export function ReconciliationToast({ trace }: ReconciliationToastProps) {
  const [visible, setVisible] = useState(false);
  const [summary, setSummary] = useState('');
  const previousTraceRef = useRef<ReconciliationTrace[]>([]);

  useEffect(() => {
    const changed =
      trace.length > 0 &&
      (trace.length !== previousTraceRef.current.length ||
        trace.some(
          (entry, index) =>
            entry.componentId !== previousTraceRef.current[index]?.componentId ||
            entry.action !== previousTraceRef.current[index]?.action
        ));

    previousTraceRef.current = trace;
    if (!changed) {
      return;
    }

    const counts: Record<string, number> = {};
    for (const entry of trace) {
      counts[entry.action] = (counts[entry.action] ?? 0) + 1;
    }

    const parts: string[] = [];
    if (counts['carried']) parts.push(`${counts['carried']} carried`);
    if (counts['added']) parts.push(`${counts['added']} added`);
    if (counts['migrated']) parts.push(`${counts['migrated']} migrated`);
    if (counts['dropped']) parts.push(`${counts['dropped']} dropped`);

    setSummary(parts.join(', '));
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(timer);
  }, [trace]);

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
        transform: 'translateX(-50%)',
        zIndex: 20,
        borderRadius: radius.lg,
        border: `1px solid ${color.border}`,
        background: color.surfaceAlt,
        padding: `${space.sm}px ${space.xl}px`,
        color: color.text,
        display: 'flex',
        gap: space.sm,
        alignItems: 'center',
        boxShadow: shadow.elevated,
      }}
    >
      <span style={{ ...typeScale.label, color: color.textMuted }}>Reconciled</span>
      <span style={typeScale.caption}>{summary}</span>
      <button
        onClick={() => setVisible(false)}
        style={{
          border: 'none',
          background: 'transparent',
          color: color.textMuted,
          cursor: 'pointer',
          ...typeScale.caption,
        }}
      >
        Close
      </button>
    </div>
  );
}

