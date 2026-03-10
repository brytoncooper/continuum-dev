import type { CSSProperties } from 'react';
import { color, space, type } from '../../ui/tokens';
import { useCasesContent } from '../content/landing-content';
import { LandingCard, LandingGrid, LandingSection } from '../landing-layout';

const titleStyle: CSSProperties = {
  ...type.section,
  color: color.text,
};

const bodyStyle: CSSProperties = {
  ...type.body,
  color: color.text,
};

export function UseCasesBlock() {
  return (
    <LandingSection title={useCasesContent.title} description={useCasesContent.description}>
      <LandingGrid>
        {useCasesContent.callouts.map((callout, index) => (
          <LandingCard key={callout.title} span={6} tone={index % 2 === 0 ? 'soft' : 'strong'}>
            <div style={titleStyle}>{callout.title}</div>
            <div style={{ ...bodyStyle, marginTop: space.sm }}>{callout.body}</div>
          </LandingCard>
        ))}
      </LandingGrid>
    </LandingSection>
  );
}
