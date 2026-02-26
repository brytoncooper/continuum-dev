import type { ReactNode } from 'react';
import { color, space } from '../tokens';

interface AppShellProps {
  header: ReactNode;
  main: ReactNode;
  devtools: ReactNode;
  devtoolsOpen: boolean;
  onToggleDevtools: () => void;
}

export function AppShell({
  header,
  main,
  devtools,
  devtoolsOpen,
  onToggleDevtools,
}: AppShellProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateRows: 'auto 1fr',
        gridTemplateColumns: devtoolsOpen ? '1fr minmax(0, 360px)' : '1fr 40px',
        height: '100vh',
        overflow: 'hidden',
        background: color.bg,
        color: color.text,
      }}
    >
      <div
        style={{
          gridColumn: '1 / -1',
          borderBottom: `1px solid ${color.border}`,
          background: color.surface,
          padding: `${space.lg}px ${space.xl}px`,
        }}
      >
        {header}
      </div>
      <div style={{ minWidth: 0, overflow: 'hidden' }}>{main}</div>
      <button
        data-testid="devtools-toggle"
        onClick={onToggleDevtools}
        style={{
          writingMode: 'vertical-rl',
          textOrientation: 'mixed',
          border: 'none',
          borderLeft: `1px solid ${color.panelBorder}`,
          borderRight: `1px solid ${color.panelBorder}`,
          background: color.panelSurface,
          color: color.panelTextSecondary,
          cursor: 'pointer',
          fontSize: 11,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          padding: `${space.md}px ${space.sm}px`,
        }}
        title={devtoolsOpen ? 'Collapse Devtools' : 'Expand Devtools'}
      >
        {devtoolsOpen ? 'Devtools Hide' : 'Devtools Show'}
      </button>
      {devtoolsOpen && (
        <div style={{ borderLeft: `1px solid ${color.panelBorder}`, background: color.panelBg, overflow: 'hidden' }}>
          {devtools}
        </div>
      )}
    </div>
  );
}

