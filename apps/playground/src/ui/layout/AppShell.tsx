import type { ReactNode } from 'react';
import { space } from '../tokens';
import { playgroundTheme } from '../playground-theme';

interface AppShellProps {
  header: ReactNode;
  main: ReactNode;
}

export function AppShell({ header, main }: AppShellProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateRows: 'auto 1fr',
        height: '100vh',
        overflow: 'hidden',
        background: playgroundTheme.gradient.page,
        color: playgroundTheme.color.text,
      }}
    >
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.72)',
          backdropFilter: 'blur(3px)',
          WebkitBackdropFilter: 'blur(3px)',
          borderBottom: `1px solid ${playgroundTheme.color.panelBorder}`,
          boxShadow: '0 4px 12px rgba(15, 23, 42, 0.06)',
          padding: `${space.lg}px ${space.xl}px`,
        }}
      >
        {header}
      </div>
      <div style={{ minWidth: 0, overflow: 'auto' }}>{main}</div>
    </div>
  );
}
