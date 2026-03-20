import type { CSSProperties } from 'react';
import {
  LandingCard,
  LandingGrid,
  LandingSection,
  LandingShell,
} from '../landing/landing-layout';
import { SiteNav } from '../ui/site-nav';
import { color, radius, space, type } from '../ui/tokens';
import {
  docsDocuments,
  docsProofChips,
  primaryInstall,
  secondaryInstalls,
  secondaryLinks,
} from './docs-content';
import { DocsDocumentViewer } from './docs-document-viewer';

const heroTagStyle: CSSProperties = {
  ...type.small,
  color: color.text,
  padding: `${space.sm}px ${space.md}px`,
  borderRadius: radius.pill,
  border: `1px solid ${color.borderSoft}`,
  background: 'rgba(255, 255, 255, 0.7)',
};

const sectionLabelStyle: CSSProperties = {
  ...type.small,
  color: color.textSoft,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
};

const cardTitleStyle: CSSProperties = {
  ...type.title,
  color: color.text,
  maxWidth: 620,
};

const bodyStyle: CSSProperties = {
  ...type.body,
  color: color.textMuted,
};

const actionsStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: space.sm,
};

const actionStyle = (
  tone: 'default' | 'soft' | 'strong' = 'default'
): CSSProperties => ({
  ...type.small,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  color:
    tone === 'strong'
      ? color.surface
      : tone === 'soft'
      ? color.highlight
      : color.text,
  textDecoration: 'none',
  padding: `${space.sm}px ${space.md}px`,
  border: `1px solid ${
    tone === 'strong'
      ? color.accentStrong
      : tone === 'soft'
      ? color.highlight
      : color.border
  }`,
  borderRadius: radius.pill,
  background:
    tone === 'strong'
      ? color.accent
      : tone === 'soft'
      ? color.highlightSoft
      : color.surface,
});

const tertiaryLinkStyle: CSSProperties = {
  ...type.small,
  color: color.textMuted,
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  padding: `${space.sm}px ${space.xs}px`,
};

const codeBlockStyle: CSSProperties = {
  ...type.body,
  color: color.text,
  margin: 0,
  padding: space.lg,
  borderRadius: radius.md,
  border: `1px solid ${color.borderSoft}`,
  background: 'rgba(255, 255, 255, 0.82)',
  overflowX: 'auto',
};

const secondaryInstallListStyle: CSSProperties = {
  display: 'grid',
  gap: space.md,
};

const secondaryInstallStyle: CSSProperties = {
  display: 'grid',
  gap: space.sm,
};

const secondaryLabelStyle: CSSProperties = {
  ...type.small,
  color: color.text,
};

const linkListStyle: CSSProperties = {
  display: 'grid',
  gap: space.sm,
};

const linkStyle: CSSProperties = {
  ...type.body,
  color: color.text,
  textDecoration: 'none',
  padding: `${space.md}px ${space.md}px`,
  borderRadius: radius.md,
  border: `1px solid ${color.borderSoft}`,
  background: color.surface,
};

export function DocsPage() {
  return (
    <LandingShell
      nav={<SiteNav />}
      heroVisual={
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: space.sm }}>
          {docsProofChips.map((tag) => (
            <div key={tag} style={heroTagStyle}>
              {tag}
            </div>
          ))}
        </div>
      }
      eyebrow="Docs"
      title="Start with Starter Kit."
      description="It's the fastest way to get Continuum running in a React app. If you want a lower-level install, the headless React and core packages are below."
    >
      <LandingGrid alignItems="stretch">
        <LandingCard span={12} tone="strong">
          <div style={sectionLabelStyle}>{primaryInstall.label}</div>
          <div style={cardTitleStyle}>{primaryInstall.title}</div>
          <div style={bodyStyle}>{primaryInstall.body}</div>
          <pre style={codeBlockStyle}>
            <code>{primaryInstall.command}</code>
          </pre>
          <div style={actionsStyle}>
            <a
              href={primaryInstall.quickStartHref}
              style={actionStyle('strong')}
            >
              Read Quick Start
            </a>
            <a href={primaryInstall.demoHref} style={actionStyle()}>
              Open demo
            </a>
            <a href="#advanced-docs" style={tertiaryLinkStyle}>
              See lower-level installs
            </a>
          </div>
        </LandingCard>
      </LandingGrid>

      <LandingSection>
        <LandingGrid alignItems="stretch">
          <LandingCard span={12} tone="default">
            <DocsDocumentViewer documents={docsDocuments} />
          </LandingCard>
        </LandingGrid>
      </LandingSection>

      <div id="advanced-docs">
        <LandingSection
          title="Lower-level installs and reference docs"
          description="Install the headless React or core packages directly, or jump to the source docs."
        >
          <LandingGrid alignItems="stretch">
            <LandingCard span={6} tone="soft" fullHeight>
              <div style={sectionLabelStyle}>Direct installs</div>
              <div style={secondaryInstallListStyle}>
                {secondaryInstalls.map((item) => (
                  <div key={item.label} style={secondaryInstallStyle}>
                    <div style={secondaryLabelStyle}>{item.label}</div>
                    <pre style={codeBlockStyle}>
                      <code>{item.command}</code>
                    </pre>
                  </div>
                ))}
              </div>
            </LandingCard>
            <LandingCard span={6} tone="default" fullHeight>
              <div style={sectionLabelStyle}>Reference docs</div>
              <div style={linkListStyle}>
                {secondaryLinks.map((item) => (
                  <a
                    key={item.label}
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    style={linkStyle}
                  >
                    {item.label}
                  </a>
                ))}
              </div>
            </LandingCard>
          </LandingGrid>
        </LandingSection>
      </div>
    </LandingShell>
  );
}
