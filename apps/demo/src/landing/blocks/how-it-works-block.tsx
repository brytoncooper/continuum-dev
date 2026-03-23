import type { CSSProperties } from 'react';
import { color, space, type } from '../../ui/tokens';
import { howItWorksContent } from '../content/landing-content';
import { LandingCard, LandingGrid, LandingSection } from '../landing-layout';

const labelStyle: CSSProperties = {
  ...type.small,
  color: color.textSoft,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
};

const titleStyle: CSSProperties = {
  ...type.section,
  color: color.text,
};

const bodyStyle: CSSProperties = {
  ...type.body,
  color: color.textMuted,
};

export function HowItWorksBlock() {
  return (
    <div id="how-it-works">
      <LandingSection
        title={howItWorksContent.title}
        description={howItWorksContent.description}
      >
        <LandingGrid alignItems="stretch">
          {howItWorksContent.steps.map((step) => (
            <LandingCard key={step.title} span={3} tone="soft" fullHeight>
              <div style={labelStyle}>{step.label.padStart(2, '0')}</div>
              <div style={titleStyle}>{step.title}</div>
              <div style={{ ...bodyStyle, marginTop: space.sm }}>
                {step.body}
              </div>
            </LandingCard>
          ))}
        </LandingGrid>
      </LandingSection>
    </div>
  );
}
