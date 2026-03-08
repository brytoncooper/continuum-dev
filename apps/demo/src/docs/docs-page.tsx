import type { CSSProperties } from 'react';
import { ExampleCard, ExampleGrid, PageSection, PageShell } from '../ui/layout';
import { SiteNav } from '../ui/site-nav';
import { color, radius, space, type } from '../ui/tokens';
import { githubProfileUrl, repositoryUrl, siteDomain } from '../site-config';
import { deepReferenceLinks, guideLinks, installOptions, packageLinks } from './docs-content';

const cardBodyStyle: CSSProperties = {
  ...type.body,
  color: color.textMuted,
};

const codeBlockStyle: CSSProperties = {
  ...type.body,
  color: color.text,
  margin: 0,
  padding: space.lg,
  borderRadius: radius.md,
  border: `1px solid ${color.borderSoft}`,
  background: color.surfaceMuted,
  overflowX: 'auto',
};

const linkListStyle: CSSProperties = {
  display: 'grid',
  gap: space.sm,
};

const actionStyle: CSSProperties = {
  ...type.small,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: color.text,
  textDecoration: 'none',
  padding: `${space.sm}px ${space.md}px`,
  border: `1px solid ${color.borderStrong}`,
  borderRadius: radius.pill,
  background: color.surface,
};

const installMetaStyle: CSSProperties = {
  ...type.small,
  color: color.textSoft,
};

function installCardSpan(title: string): 6 | 12 {
  return title === 'Core only' ? 12 : 6;
}

export function DocsPage() {
  return (
    <PageShell
      nav={<SiteNav />}
      eyebrow="Docs"
      title="Launch-ready docs for the headless Continuum stack and the opinionated Starter Kit."
      description="Everything linked here is tracked in git. Use the Starter Kit when you want the fastest path to a working UI, or stay headless with React and core when you want full control."
    >
      <PageSection
        title="Start Here"
        description="Choose the install path that matches how much UI you want Continuum to provide out of the box."
      >
        <ExampleGrid alignItems="stretch">
          {installOptions.map((option) => (
            <ExampleCard
              key={option.title}
              title={option.title}
              description={option.description}
              span={installCardSpan(option.title)}
              fullHeight
            >
              <div style={installMetaStyle}>Install</div>
              <pre style={codeBlockStyle}>
                <code>{option.command}</code>
              </pre>
            </ExampleCard>
          ))}
        </ExampleGrid>
      </PageSection>
      <PageSection
        title="Read The Guides"
        description="These are the tracked docs to read before shipping an integration or posting the project publicly."
      >
        <ExampleGrid alignItems="stretch">
          {guideLinks.map((item) => (
            <ExampleCard key={item.title} title={item.title} description={item.description} span={6} fullHeight>
              <div style={linkListStyle}>
                <a href={item.href} target="_blank" rel="noreferrer" style={actionStyle}>
                  Open on GitHub
                </a>
              </div>
            </ExampleCard>
          ))}
        </ExampleGrid>
      </PageSection>
      <PageSection
        title="Package Docs"
        description="The npm surface is intentionally layered: core for the runtime spine, react for headless UI bindings, starter-kit for convenience, and prompts for model-facing helpers."
      >
        <ExampleGrid alignItems="stretch">
          {packageLinks.map((item) => (
            <ExampleCard key={item.title} title={item.title} description={item.description} span={6} fullHeight>
              <div style={linkListStyle}>
                <a href={item.href} target="_blank" rel="noreferrer" style={actionStyle}>
                  README
                </a>
              </div>
            </ExampleCard>
          ))}
        </ExampleGrid>
      </PageSection>
      <PageSection
        title="Deep Reference"
        description="When you need exact contracts or engine details, jump directly into the tracked references."
      >
        <ExampleGrid alignItems="stretch">
          {deepReferenceLinks.map((item) => (
            <ExampleCard key={item.title} title={item.title} description={item.description} span={6} fullHeight>
              <div style={linkListStyle}>
                <a href={item.href} target="_blank" rel="noreferrer" style={actionStyle}>
                  Open reference
                </a>
              </div>
            </ExampleCard>
          ))}
        </ExampleGrid>
      </PageSection>
      <PageSection
        title="Links"
        description="These are the public launch links for Continuum."
      >
        <ExampleGrid alignItems="stretch">
          <ExampleCard
            title="Website"
            description="Public home for the project and the domain you can post everywhere."
            span={4}
            fullHeight
          >
            <div style={cardBodyStyle}>{siteDomain}</div>
          </ExampleCard>
          <ExampleCard
            title="Repository"
            description="The source of truth for release history, package docs, and tracked markdown."
            span={4}
            fullHeight
          >
            <a href={repositoryUrl} target="_blank" rel="noreferrer" style={actionStyle}>
              Open repository
            </a>
          </ExampleCard>
          <ExampleCard
            title="GitHub"
            description="Profile link for the project owner and launch posts."
            span={4}
            fullHeight
          >
            <a href={githubProfileUrl} target="_blank" rel="noreferrer" style={actionStyle}>
              Open profile
            </a>
          </ExampleCard>
        </ExampleGrid>
      </PageSection>
    </PageShell>
  );
}
