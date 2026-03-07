import type { CSSProperties } from 'react';
import { color, space, type } from '../../ui/tokens';
import { problemContent } from '../content/landing-content';
import { LandingCard, LandingGrid, LandingSection } from '../landing-layout';

const titleStyle: CSSProperties = {
  ...type.title,
  color: color.text,
};

const bodyStyle: CSSProperties = {
  ...type.body,
  color: color.text,
};

export function ProblemBlock() {
  return (
    <div id="the-problem">
      <LandingSection title={problemContent.title} description={problemContent.description}>
        <LandingGrid alignItems="stretch">
          {problemContent.callouts.map((callout) => (
            <LandingCard key={callout.title} span={4} fullHeight>
              <div style={titleStyle}>{callout.title}</div>
              <div style={{ ...bodyStyle, marginTop: space.sm }}>{callout.body}</div>
            </LandingCard>
          ))}
        </LandingGrid>
      </LandingSection>
    </div>
  );
}
