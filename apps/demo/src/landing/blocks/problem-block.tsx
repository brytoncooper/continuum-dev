import type { CSSProperties } from 'react';
import { color, space, type } from '../../ui/tokens';
import { problemContent } from '../content/landing-content';
import { LandingCard, LandingGrid, LandingSection } from '../landing-layout';

const titleStyle: CSSProperties = {
  ...type.section,
  color: color.text,
};

const bodyStyle: CSSProperties = {
  ...type.body,
  color: color.textMuted,
};

export function ProblemBlock() {
  return (
    <div id="the-problem">
      <LandingSection
        title={problemContent.title}
        description={problemContent.description}
      >
        <LandingGrid alignItems="stretch">
          {problemContent.callouts.map((callout, index) => (
            <LandingCard
              key={callout.title}
              span={4}
              tone={index === 0 ? 'strong' : 'soft'}
              fullHeight
            >
              <div style={titleStyle}>{callout.title}</div>
              <div style={{ ...bodyStyle, marginTop: space.sm }}>
                {callout.body}
              </div>
            </LandingCard>
          ))}
        </LandingGrid>
      </LandingSection>
    </div>
  );
}
