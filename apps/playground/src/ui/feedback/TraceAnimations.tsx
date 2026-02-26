import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReconciliationTrace } from '@continuum/runtime';
import { color } from '../tokens';

interface TraceAnimationsProps {
  trace: ReconciliationTrace[];
}

export function TraceAnimations({ trace }: TraceAnimationsProps) {
  const [animationKey, setAnimationKey] = useState(0);
  const previousTraceRef = useRef<ReconciliationTrace[]>([]);

  useEffect(() => {
    const changed =
      trace.length !== previousTraceRef.current.length ||
      trace.some(
        (entry, index) =>
          entry.componentId !== previousTraceRef.current[index]?.componentId ||
          entry.action !== previousTraceRef.current[index]?.action
      );

    if (changed) {
      previousTraceRef.current = trace;
      setAnimationKey((value) => value + 1);
    }
  }, [trace]);

  const css = useMemo(() => buildTraceStyles(trace), [trace]);
  if (!css) {
    return null;
  }

  return <style key={animationKey} dangerouslySetInnerHTML={{ __html: css }} />;
}

function buildTraceStyles(trace: ReconciliationTrace[]): string {
  const keyframes = `
@keyframes continuum-shake {
  0%, 100% { transform: translateX(0); }
  15% { transform: translateX(-4px); }
  30% { transform: translateX(4px); }
  45% { transform: translateX(-3px); }
  60% { transform: translateX(3px); }
  75% { transform: translateX(-1px); }
  90% { transform: translateX(1px); }
}
@keyframes continuum-pulse {
  0% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.55); }
  50% { box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.25); }
  100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); }
}
@keyframes continuum-fadein {
  0% { opacity: 0; transform: translateY(6px); }
  100% { opacity: 1; transform: translateY(0); }
}
`;

  const rules = trace
    .filter((entry) => entry.action !== 'carried')
    .map((entry) => {
      const selector = `[data-continuum-id="${entry.componentId}"]`;
      if (entry.action === 'dropped') {
        return `${selector} { animation: continuum-shake 0.5s ease; border-radius: 6px; outline: 2px solid ${color.danger}; outline-offset: 2px; }`;
      }
      if (entry.action === 'migrated') {
        return `${selector} { animation: continuum-pulse 0.6s ease; border-radius: 6px; outline: 2px solid ${color.warning}; outline-offset: 2px; }`;
      }
      if (entry.action === 'added') {
        return `${selector} { animation: continuum-fadein 0.4s ease; border-radius: 6px; outline: 2px solid ${color.success}; outline-offset: 2px; }`;
      }
      return '';
    })
    .filter((rule) => rule.length > 0);

  if (rules.length === 0) {
    return '';
  }
  return keyframes + rules.join('\n');
}

