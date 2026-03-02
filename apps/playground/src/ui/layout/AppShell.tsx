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
          background: 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          borderBottom: `1px solid ${playgroundTheme.color.panelBorder}`,
          boxShadow:
            '0 4px 14px rgba(15, 23, 42, 0.08), inset 0 -1px 0 rgba(79, 70, 229, 0.12)',
          padding: `${space.lg}px ${space.xl}px`,
        }}
      >
        {header}
      </div>
      <div style={{ minWidth: 0, overflow: 'auto' }}>{main}</div>
    </div>
  );
}
