import type { CSSProperties } from 'react';
import { color, space, type } from '../../ui/tokens';
import { continuityContent } from '../content/landing-content';
import { LandingCard, LandingGrid, LandingSection } from '../landing-layout';

const headingStyle: CSSProperties = {
  ...type.label,
  color: color.textSoft,
};

const bodyStyle: CSSProperties = {
  ...type.body,
  color: color.text,
};

const summaryStyle: CSSProperties = {
  ...type.section,
  color: color.text,
  marginTop: space.md,
  paddingLeft: space.lg,
};

export function ContinuityBlock() {
  return (
    <LandingSection title={continuityContent.title} description={continuityContent.description}>
      <LandingGrid>
        {continuityContent.columns.map((column) => (
          <LandingCard key={column.title} span={6} tone="strong">
            <div style={headingStyle}>{column.title}</div>
            <div style={{ ...bodyStyle, marginTop: space.md }}>{column.body}</div>
          </LandingCard>
        ))}
      </LandingGrid>
      <div style={summaryStyle}>{continuityContent.summary}</div>
    </LandingSection>
  );
}
