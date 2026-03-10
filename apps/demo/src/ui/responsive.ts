import { useEffect, useState } from 'react';

export const demoBreakpoints = {
  mobile: 820,
} as const;

function readViewportWidth() {
  if (typeof window === 'undefined') {
    return 1280;
  }

  return window.innerWidth;
}

export function useResponsiveState() {
  const [viewportWidth, setViewportWidth] = useState(readViewportWidth);

  useEffect(() => {
    const handleResize = () => {
      setViewportWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return {
    viewportWidth,
    isMobile: viewportWidth <= demoBreakpoints.mobile,
  };
}
