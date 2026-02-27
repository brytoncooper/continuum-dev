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
        minHeight: '100%',
        color: playgroundTheme.color.text,
        padding: space.xl,
      }}
    >
      <div
        style={{
          maxWidth: 760,
          margin: '0 auto',
          display: 'grid',
          gap: space.xl,
        }}
      >
        {banner}
        {controls}
        {valueCallout}
        <div
          data-testid="generated-ui"
          style={{
            background: playgroundTheme.color.surface,
            borderRadius: radius.lg,
            border: `1px solid ${playgroundTheme.color.border}`,
            boxShadow: playgroundTheme.shadow.card,
            padding: space.xl,
            display: 'grid',
            gap: space.lg,
          }}
        >
          <div
            style={{
              ...typeScale.label,
              color: playgroundTheme.color.text,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            Generated UI
          </div>
          {valueCallout}
          <div style={{ display: 'grid', gap: space.lg }}>
            {renderedUi}
          </div>
        </div>
        <div>
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
