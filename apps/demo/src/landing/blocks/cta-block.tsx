import type { CSSProperties } from 'react';
import { color, radius, space, type } from '../../ui/tokens';
import { ctaContent } from '../content/landing-content';
import { LandingCard, LandingGrid, LandingSection } from '../landing-layout';

const descriptionStyle: CSSProperties = {
  ...type.title,
  color: color.text,
};

const actionsStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: space.sm,
  marginTop: space.md,
};

const actionLabelStyle: CSSProperties = {
  ...type.label,
  color: color.textSoft,
  marginTop: space.lg,
};

const actionStyle: CSSProperties = {
  ...type.small,
  color: color.text,
  textDecoration: 'none',
  padding: `${space.sm}px ${space.md}px`,
  border: `1px solid ${color.borderStrong}`,
  borderRadius: radius.pill,
  background: color.surface,
};

export function CtaBlock() {
  return (
    <LandingSection title={ctaContent.title} description={ctaContent.description}>
      <LandingGrid>
        <LandingCard span={12} tone="strong">
          <div style={descriptionStyle}>
            Dynamic interfaces stop feeling like a gamble when reconciliation, persistence,
            proposals, diagnostics, and headless rendering already work together.
          </div>
          <div style={actionLabelStyle}>Jump to</div>
          <div style={actionsStyle}>
            {ctaContent.links.map((link) => (
              <a key={link.href} href={link.href} style={actionStyle}>
                {link.label}
              </a>
            ))}
          </div>
        </LandingCard>
      </LandingGrid>
    </LandingSection>
  );
}
