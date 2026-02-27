import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReconciliationTrace } from '@continuum/runtime';
import { playgroundTheme } from '../playground-theme';

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
  0% { box-shadow: inset 3px 0 0 ${playgroundTheme.color.warning}; }
  50% { box-shadow: inset 3px 0 0 ${playgroundTheme.color.warning}, 0 0 0 2px rgba(245, 158, 11, 0.22); }
  100% { box-shadow: inset 3px 0 0 ${playgroundTheme.color.warning}; }
}
@keyframes continuum-fadein {
  0% { opacity: 0; transform: translateY(6px); }
  100% { opacity: 1; transform: translateY(0); }
}
@keyframes continuum-clear-decoration {
  0% { box-shadow: var(--continuum-highlight-shadow); background: var(--continuum-highlight-bg); }
  100% { box-shadow: none; background: transparent; }
}
`;

  const successBg = playgroundTheme.color.successBg;
  const warningBg = playgroundTheme.color.warningBg;
  const dangerBg = playgroundTheme.color.dangerBg;

  const rules = trace
    .filter((entry) => entry.action !== 'carried')
    .map((entry) => {
      const selector = `[data-continuum-id="${entry.componentId}"]`;
      const base = `padding: 8px; border-radius: 8px; margin: 4px 0;`;
      if (entry.action === 'dropped') {
        return `${selector} { ${base} --continuum-highlight-shadow: inset 3px 0 0 ${playgroundTheme.color.danger}; --continuum-highlight-bg: ${dangerBg}; box-shadow: inset 3px 0 0 ${playgroundTheme.color.danger}; background: ${dangerBg}; animation: continuum-shake 0.5s ease, continuum-clear-decoration 0.4s ease 2.6s forwards; }`;
      }
      if (entry.action === 'migrated') {
        return `${selector} { ${base} --continuum-highlight-shadow: inset 3px 0 0 ${playgroundTheme.color.warning}; --continuum-highlight-bg: ${warningBg}; box-shadow: inset 3px 0 0 ${playgroundTheme.color.warning}; background: ${warningBg}; animation: continuum-pulse 0.6s ease 2, continuum-clear-decoration 0.4s ease 2.6s forwards; }`;
      }
      if (entry.action === 'added') {
        return `${selector} { ${base} --continuum-highlight-shadow: inset 3px 0 0 ${playgroundTheme.color.success}; --continuum-highlight-bg: ${successBg}; box-shadow: inset 3px 0 0 ${playgroundTheme.color.success}; background: ${successBg}; animation: continuum-fadein 0.4s ease, continuum-clear-decoration 0.4s ease 2.6s forwards; }`;
      }
      return '';
    })
    .filter((rule) => rule.length > 0);

  if (rules.length === 0) {
    return '';
  }
  return keyframes + rules.join('\n');
}

