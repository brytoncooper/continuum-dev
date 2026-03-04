import { useEffect, useState, type ReactNode } from 'react';
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
  const [isCompact, setIsCompact] = useState(() => window.innerWidth < 1360);

  useEffect(() => {
    const onResize = () => {
      setIsCompact(window.innerWidth < 1360);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isCompact ? 'column' : 'row',
        gap: space.xxxl,
        padding: space.sectionGap,
        height: '100%',
        boxSizing: 'border-box',
        color: playgroundTheme.color.text,
      }}
    >
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: space.panelGap,
          minWidth: 0,
          minHeight: isCompact ? 480 : undefined,
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
            gap: space.panelGap,
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

      <div
        style={{
          width: isCompact ? '100%' : 420,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: space.panelGap,
          overflowY: isCompact ? 'visible' : 'auto',
          paddingRight: space.sm,
        }}
      >
        <div
          style={{
            ...typeScale.overline,
            color: playgroundTheme.color.muted,
            marginBottom: space.xs,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          Controls
        </div>
        {controls}

        <details style={{ display: 'grid', gap: space.sm }}>
          <summary
            style={{
              ...typeScale.overline,
              color: playgroundTheme.color.soft,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              cursor: 'pointer',
            }}
          >
            Diagnostics
          </summary>
          {devtools}
        </details>
      </div>
    </div>
  );
}
