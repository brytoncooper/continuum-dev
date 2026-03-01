import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReconciliationResolution } from '@continuum/runtime';
import { playgroundTheme } from '../playground-theme';

interface ResolutionAnimationsProps {
  resolutions: ReconciliationResolution[];
}

export function TraceAnimations({ resolutions }: ResolutionAnimationsProps) {
  const [animationKey, setAnimationKey] = useState(0);
  const previousResolutionsRef = useRef<ReconciliationResolution[]>([]);

  useEffect(() => {
    const changed =
      resolutions.length !== previousResolutionsRef.current.length ||
      resolutions.some(
        (entry, index) =>
          entry.nodeId !== previousResolutionsRef.current[index]?.nodeId ||
          entry.resolution !== previousResolutionsRef.current[index]?.resolution
      );

    if (changed) {
      previousResolutionsRef.current = resolutions;
      setAnimationKey((value) => value + 1);
    }
  }, [resolutions]);

  const css = useMemo(() => buildResolutionStyles(resolutions), [resolutions]);
  if (!css) {
    return null;
  }

  return <style key={animationKey} dangerouslySetInnerHTML={{ __html: css }} />;
}

function buildResolutionStyles(resolutions: ReconciliationResolution[]): string {
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

  const rules = resolutions
    .filter((entry) => entry.resolution !== 'carried')
    .map((entry) => {
      const selector = `[data-continuum-id="${entry.nodeId}"]`;
      const base = `padding: 8px; border-radius: 8px; margin: 4px 0;`;
      if (entry.resolution === 'dropped') {
        return `${selector} { ${base} --continuum-highlight-shadow: inset 3px 0 0 ${playgroundTheme.color.danger}; --continuum-highlight-bg: ${dangerBg}; box-shadow: inset 3px 0 0 ${playgroundTheme.color.danger}; background: ${dangerBg}; animation: continuum-shake 0.5s ease, continuum-clear-decoration 0.4s ease 2.6s forwards; }`;
      }
      if (entry.resolution === 'migrated') {
        return `${selector} { ${base} --continuum-highlight-shadow: inset 3px 0 0 ${playgroundTheme.color.warning}; --continuum-highlight-bg: ${warningBg}; box-shadow: inset 3px 0 0 ${playgroundTheme.color.warning}; background: ${warningBg}; animation: continuum-pulse 0.6s ease 2, continuum-clear-decoration 0.4s ease 2.6s forwards; }`;
      }
      if (entry.resolution === 'added') {
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
