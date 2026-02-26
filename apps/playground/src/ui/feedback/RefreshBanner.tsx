import { useEffect, useState } from 'react';
import { color, radius, space, typeScale } from '../tokens';

interface RefreshBannerProps {
  wasRehydrated: boolean;
}

export function RefreshBanner({ wasRehydrated }: RefreshBannerProps) {
  const [visible, setVisible] = useState(wasRehydrated);

  useEffect(() => {
    if (!wasRehydrated) {
      return;
    }
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 5000);
    return () => clearTimeout(timer);
  }, [wasRehydrated]);

  if (!visible) {
    return null;
  }

  return (
    <div
      data-testid="refresh-banner"
      style={{
        padding: `${space.md}px ${space.lg}px`,
        borderRadius: radius.lg,
        border: `1px solid ${color.borderFocus}`,
        background: color.infoBg,
        color: color.accent,
        display: 'flex',
        alignItems: 'center',
        gap: space.sm,
      }}
    >
      <span style={typeScale.body}>Refresh restored your previous session state.</span>
      <button
        onClick={() => setVisible(false)}
        style={{
          border: 'none',
          background: 'transparent',
          color: color.accent,
          cursor: 'pointer',
          marginLeft: 'auto',
          ...typeScale.caption,
        }}
      >
        Close
      </button>
    </div>
  );
}

