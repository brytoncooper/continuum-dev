import type { CSSProperties } from 'react';
import { ExampleCard, ExampleGrid, PageSection, PageShell } from '../ui/layout';
import { SiteNav } from '../ui/site-nav';
import { color, radius, space, type } from '../ui/tokens';
import {
  githubProfileUrl,
  maintainerEmail,
  maintainerName,
  repositoryUrl,
} from '../site-config';
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
      title="Install Continuum from the open-source repo with docs for Starter Kit, React, and core."
      description="These docs are the fastest path from GitHub to installation. Use the Starter Kit when you want a polished UI quickly, or stay headless with React and core when you want full control."
    >
      <PageSection
        title="Start Here"
        description="Start with GitHub when you want the source, package layout, and tracked markdown in one place. Then choose the install path that matches how much UI you want Continuum to provide."
      >
        <ExampleGrid alignItems="stretch">
          <ExampleCard
            title="Inspect source before install"
            description="GitHub is the fastest trust step because it gives you the repository, package docs, and tracked setup path in one click."
            span={12}
            fullHeight
          >
            <div style={linkListStyle}>
              <a href={repositoryUrl} target="_blank" rel="noreferrer" style={actionStyle}>
                View Continuum on GitHub
              </a>
              <a href="/playground" style={actionStyle}>
                Try the static continuity demo
              </a>
            </div>
          </ExampleCard>
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
        description="These are the tracked docs to read before wiring an integration, sharing the project internally, or committing to an install path."
      >
        <ExampleGrid alignItems="stretch">
          {guideLinks.map((item) => (
            <ExampleCard key={item.title} title={item.title} description={item.description} span={6} fullHeight>
              <div style={linkListStyle}>
                <a href={item.href} target="_blank" rel="noreferrer" style={actionStyle}>
                  Read on GitHub
                </a>
              </div>
            </ExampleCard>
          ))}
        </ExampleGrid>
      </PageSection>
      <PageSection
        title="Package Docs"
        description="The npm surface is intentionally layered: core for the runtime spine, React for headless UI bindings, starter-kit for convenience, and prompts for model-facing helpers."
      >
        <ExampleGrid alignItems="stretch">
          {packageLinks.map((item) => (
            <ExampleCard key={item.title} title={item.title} description={item.description} span={6} fullHeight>
              <div style={linkListStyle}>
                <a href={item.href} target="_blank" rel="noreferrer" style={actionStyle}>
                  Open package README
                </a>
              </div>
            </ExampleCard>
          ))}
        </ExampleGrid>
      </PageSection>
      <PageSection
        title="Deep Reference"
        description="When you need exact contracts or engine details before installing deeper into the stack, jump directly into the tracked references."
      >
        <ExampleGrid alignItems="stretch">
          {deepReferenceLinks.map((item) => (
            <ExampleCard key={item.title} title={item.title} description={item.description} span={6} fullHeight>
              <div style={linkListStyle}>
                <a href={item.href} target="_blank" rel="noreferrer" style={actionStyle}>
                  Open tracked reference
                </a>
              </div>
            </ExampleCard>
          ))}
        </ExampleGrid>
      </PageSection>
      <PageSection
        title="Links"
        description="These are the public links most likely to help a new evaluator move from trust to install."
      >
        <ExampleGrid alignItems="stretch">
          <ExampleCard
            title="Repository"
            description="The source of truth for release history, package docs, and tracked markdown."
            span={4}
            fullHeight
          >
            <a href={repositoryUrl} target="_blank" rel="noreferrer" style={actionStyle}>
              View on GitHub
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
          <ExampleCard
            title="Maintainer"
            description="Contact for partnerships, support, or launch follow-up."
            span={4}
            fullHeight
          >
            <div style={{ ...cardBodyStyle, marginBottom: space.sm }}>{maintainerName}</div>
            <a href={`mailto:${maintainerEmail}`} style={actionStyle}>
              {maintainerEmail}
            </a>
          </ExampleCard>
        </ExampleGrid>
      </PageSection>
    </PageShell>
  );
}
