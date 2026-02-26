import type { ReactNode } from 'react';
import { color, radius, shadow, space, typeScale } from '../tokens';

interface MainStageProps {
  banner: ReactNode;
  controls: ReactNode;
  rewind: ReactNode;
  valueCallout: ReactNode;
  renderedUi: ReactNode;
}

export function MainStage({
  banner,
  controls,
  rewind,
  valueCallout,
  renderedUi,
}: MainStageProps) {
  return (
    <div
      style={{
        height: '100%',
        overflow: 'auto',
        padding: space.xl,
      }}
    >
      <div
        style={{
          maxWidth: 920,
          margin: '0 auto',
          display: 'grid',
          gap: space.lg,
        }}
      >
        {banner}
        {controls}
        {rewind}
        {valueCallout}
        <div
          data-testid="generated-ui"
          style={{
            background: color.surface,
            borderRadius: radius.lg,
            border: `1px solid ${color.border}`,
            boxShadow: shadow.card,
            padding: space.xl,
          }}
        >
          <div
            style={{
              ...typeScale.label,
              color: color.textMuted,
              marginBottom: space.lg,
            }}
          >
            Generated UI
          </div>
          <div style={{ maxWidth: 720, margin: '0 auto', display: 'grid', gap: space.lg }}>
            {renderedUi}
          </div>
        </div>
      </div>
    </div>
  );
}

