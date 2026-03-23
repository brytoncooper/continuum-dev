import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { control, space } from '../../tokens.js';

const compactViewportQuery = '(max-width: 680px)';

export function responsiveGridColumns(columns: number, minWidth = 240) {
  if (columns <= 1) {
    return 'minmax(0, 1fr)';
  }

  return `repeat(auto-fit, minmax(min(100%, ${minWidth}px), 1fr))`;
}

export function useCompactViewport(query = compactViewportQuery): boolean {
  const [matches, setMatches] = useState(() => {
    if (
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    ) {
      return false;
    }

    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    ) {
      return;
    }

    const mediaQuery = window.matchMedia(query);
    const updateMatches = () => setMatches(mediaQuery.matches);

    updateMatches();

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', updateMatches);
      return () => mediaQuery.removeEventListener('change', updateMatches);
    }

    mediaQuery.addListener(updateMatches);
    return () => mediaQuery.removeListener(updateMatches);
  }, [query]);

  return matches;
}

export function compactFieldControlStyle(isCompact: boolean): CSSProperties {
  if (!isCompact) {
    return {};
  }

  return {
    minHeight: control.height + space.xs,
    height: 'auto',
    padding: `${space.md}px ${control.paddingX}px`,
    fontSize: 16,
    lineHeight: 1.4,
  };
}
