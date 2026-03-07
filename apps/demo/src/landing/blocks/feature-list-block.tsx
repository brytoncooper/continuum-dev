import type { CSSProperties } from 'react';
import { color, space, type } from '../../ui/tokens';
import { featureListContent } from '../content/landing-content';
import { LandingCard, LandingGrid, LandingSection } from '../landing-layout';

const titleStyle: CSSProperties = {
  ...type.section,
  color: color.text,
};

const bodyStyle: CSSProperties = {
  ...type.body,
  color: color.text,
};

export function FeatureListBlock() {
  return (
    <div id="feature-highlights">
      <LandingSection title={featureListContent.title} description={featureListContent.description}>
        <LandingGrid>
          {featureListContent.items.map((item) => (
            <LandingCard key={item.title} span={6}>
              <div style={titleStyle}>{item.title}</div>
              <div style={{ ...bodyStyle, marginTop: space.sm }}>{item.body}</div>
            </LandingCard>
          ))}
        </LandingGrid>
      </LandingSection>
    </div>
  );
}
