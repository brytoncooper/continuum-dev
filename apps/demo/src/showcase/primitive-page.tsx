import { useState } from 'react';
import { ExampleCard, ExampleGrid, PageSection, PageShell } from '../ui/layout';
import { repositoryUrl } from '../site-config';
import { SiteNav } from '../ui/site-nav';
import { PrimitiveView } from './primitive-view';
import { demoSections } from './schemas';
import { color, radius, space, type } from '../ui/tokens';

const codeStyle = {
  margin: 0,
  padding: 16,
  borderRadius: 12,
  border: '1px solid #e7e7e2',
  background: '#f8f8f6',
  overflowX: 'auto' as const,
};

const actionStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  textDecoration: 'none',
  padding: '8px 12px',
  border: '1px solid #111111',
  borderRadius: 999,
  color: '#111111',
};

const installCardStyle = {
  display: 'grid',
  height: '100%',
};

const liveHeroStyle = {
  display: 'grid',
  gap: space.md,
  padding: space.xl,
  borderRadius: radius.md,
  border: `1px solid ${color.borderStrong}`,
  background: color.surfaceMuted,
};

const liveHeroTitleStyle = {
  ...type.title,
  color: color.text,
};

const liveHeroBodyStyle = {
  ...type.body,
  color: color.textMuted,
};

const highlightBodyStyle = {
  ...type.body,
  color: color.textMuted,
};

const relevanceHighlights = [
  {
    title: 'Live AI provider chat',
    description:
      'Starter-kit includes provider chat wiring with model selection, token handling, output contract generation, and one-click run flows.',
  },
  {
    title: 'Session workbench and rewind',
    description:
      'Users get reset, checkpoints, preview-before-rewind, and confirmation flows for safer experimentation.',
  },
  {
    title: 'Per-field proposals and suggestions',
    description:
      'AI updates can be reviewed at field level with accept/reject behavior and bulk suggestion controls.',
  },
  {
    title: 'Starter prompts and quick try UX',
    description:
      'Optional suggested prompts with copy support make zero-setup demos easy while staying opt-in in code.',
  },
  {
    title: 'Style customization without lock-in',
    description:
      'Starter-kit ships sensible defaults, but teams can override style slots and swap primitives over time.',
  },
];

function InstallCard({
  title,
  description,
  command,
}: {
  title: string;
  description: string;
  command: string;
}) {
  const [copied, setCopied] = useState(false);

  const copyCommand = async () => {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <ExampleCard
      title={title}
      description={description}
      span={6}
      fullHeight
      headerAction={
        <button type="button" style={actionStyle} onClick={() => void copyCommand()}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      }
    >
      <div style={installCardStyle}>
        <pre style={codeStyle}>
          <code>{command}</code>
        </pre>
      </div>
    </ExampleCard>
  );
}

export function PrimitivePage() {
  const orderedSections = [
    ...demoSections.filter((section) => section.title === 'Container primitives'),
    ...demoSections.filter((section) => section.title === 'Nested composition'),
    ...demoSections.filter((section) => section.title === 'Primitive gallery'),
  ];

  return (
    <PageShell
      nav={<SiteNav />}
      eyebrow="Starter Kit"
      title="Continuum Starter Kit gets developers from GitHub to working dynamic UI faster."
      description="Continuum keeps the continuity runtime headless so teams can bring their own design system. The Starter Kit is the opinionated React layer for faster installation, proof, and adoption when you want a polished path from source to working UI."
    >
      <PageSection
        title="Inspect the repo, then try the Starter Kit path"
        description="Inspect GitHub, open the setup docs, or jump straight into the Live AI demo to see the starter-kit experience working end to end."
      >
        <ExampleGrid alignItems="stretch">
          <ExampleCard
            title="Built with starter-kit primitives"
            description="The Live AI page is built with starter-kit components end to end. If this experience feels right, the next step is GitHub and install."
            span={12}
            fullHeight
          >
            <div style={liveHeroStyle}>
              <div style={liveHeroTitleStyle}>Open the repo, then choose your proof path</div>
              <div style={liveHeroBodyStyle}>
                GitHub gives you the source, tracked docs, and packages in one place. The Live AI demo shows the full starter-kit workflow end to end.
              </div>
              <div style={{ display: 'flex', gap: space.sm, flexWrap: 'wrap' }}>
                <a href={repositoryUrl} target="_blank" rel="noreferrer" style={actionStyle}>
                  View on GitHub
                </a>
                <a href="/docs" style={actionStyle}>
                  Install / Read setup docs
                </a>
                <a href="/live-ai" style={actionStyle}>
                  Launch Live AI
                </a>
              </div>
            </div>
          </ExampleCard>
        </ExampleGrid>
      </PageSection>

      <PageSection
        title="What Is Most Relevant Right Now"
        description="These are the newest starter-kit capabilities, ordered by what delivers immediate value to teams evaluating Continuum."
      >
        <ExampleGrid alignItems="stretch">
          {relevanceHighlights.map((item) => (
            <ExampleCard
              key={item.title}
              title={item.title}
              description={item.description}
              span={6}
              fullHeight
            >
              <div style={highlightBodyStyle}>Available in starter-kit now.</div>
            </ExampleCard>
          ))}
        </ExampleGrid>
      </PageSection>

      <PageSection
        title="Use the layer that matches your team"
        description="Start with the Starter Kit when you want the fastest path to a polished screen. Drop down to headless React and core when you want more control over your install surface and component system."
      >
        <ExampleGrid alignItems="stretch">
          <InstallCard
            title="Starter Kit install"
            description="Opinionated primitives, proposal helpers, and prompt helpers in one package."
            command="npm install @continuum-dev/starter-kit react"
          />
          <InstallCard
            title="Headless install"
            description="Stay fully headless and bring your own components from day one."
            command="npm install @continuum-dev/react @continuum-dev/core react"
          />
          <ExampleCard
            title="Next steps"
            description="GitHub is the fastest way to inspect the source, packages, and tracked docs before you install."
            span={12}
            fullHeight
          >
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <a href={repositoryUrl} target="_blank" rel="noreferrer" style={actionStyle}>
                View on GitHub
              </a>
              <a href="/docs" style={actionStyle}>
                Read setup docs
              </a>
            </div>
          </ExampleCard>
        </ExampleGrid>
      </PageSection>
      {orderedSections.map((section) => (
        <PageSection key={section.title} title={section.title} description={section.description}>
          <ExampleGrid alignItems="stretch">
            {section.examples.map((example) => (
              <ExampleCard
                key={example.title}
                title={example.title}
                description={example.description}
                span={example.span ?? 6}
                fullHeight
              >
                <PrimitiveView example={example} />
              </ExampleCard>
            ))}
          </ExampleGrid>
        </PageSection>
      ))}
    </PageShell>
  );
}
