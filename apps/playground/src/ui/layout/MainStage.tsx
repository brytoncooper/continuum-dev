import type { ReactNode } from 'react';
import { radius, space, typeScale } from '../tokens';
import { playgroundTheme } from '../playground-theme';

interface MainStageProps {
  banner: ReactNode;
  controls: ReactNode;
  valueCallout: ReactNode;
  renderedUi: ReactNode;
  devtools: ReactNode;
}

export function MainStage({
  banner,
  controls,
  valueCallout,
  renderedUi,
  devtools,
}: MainStageProps) {
  return (
    <div
      style={{
        display: 'flex',
        gap: space.xxxl,
        padding: space.xl,
        height: '100%',
        boxSizing: 'border-box',
        color: playgroundTheme.color.text,
      }}
    >
      {/* Left Pane: Generated UI (Takes remaining space) */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: space.xl,
          minWidth: 0,
        }}
      >
        {banner}
        <div
          data-testid="generated-ui"
          style={{
            flex: 1,
            background: playgroundTheme.color.panel,
            borderRadius: radius.lg,
            border: `1px solid ${playgroundTheme.color.panelBorder}`,
            boxShadow: `${playgroundTheme.shadow.card}, inset 0 0 0 1px ${playgroundTheme.color.borderGlow}`,
            padding: space.xxl,
            display: 'flex',
            flexDirection: 'column',
            gap: space.lg,
            overflowY: 'auto',
          }}
        >
          <div
            style={{
              ...typeScale.label,
              color: playgroundTheme.color.text,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              flexShrink: 0,
            }}
          >
            Generated UI
          </div>
          {valueCallout}
          <div style={{ display: 'grid', gap: space.xl }}>
            {renderedUi}
          </div>
        </div>
      </div>

      {/* Right Pane: Controls & Devtools (Fixed width, independent scroll) */}
      <div
        style={{
          width: 440,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: space.xl,
          overflowY: 'auto',
          paddingRight: space.sm, // space for scrollbar
        }}
      >
        {controls}
        
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div
            style={{
              ...typeScale.label,
              color: playgroundTheme.color.muted,
              marginBottom: space.sm,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            Devtools
          </div>
          {devtools}
        </div>
      </div>
    </div>
  );
}
