import { useState } from 'react';
import { ExampleCard, ExampleGrid, PageSection, PageShell } from '../ui/layout';
import { repositoryUrl } from '../site-config';
import { SiteNav } from '../ui/site-nav';
import { PrimitiveView } from './primitive-view';
import { demoSections } from './schemas';

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
  return (
    <PageShell
      nav={<SiteNav />}
      eyebrow="Starter Kit"
      title="Continuum is headless by design. The Starter Kit gets teams moving fast."
      description="Continuum keeps the continuity layer headless so teams can bring their own design system. The Starter Kit is the opinionated React layer we provide for faster adoption, with ready-to-use primitives, action wiring patterns, and proposal-friendly UI."
    >
      <PageSection
        title="Use the layer that matches your team"
        description="Start with the Starter Kit when you want a polished path to working screens. Drop down to headless React and core when you want full control over your component system and styling."
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
            description="Read the tracked docs or inspect the repo before wiring your own actions and prompts."
            span={12}
            fullHeight
          >
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <a href="/docs" style={actionStyle}>
                Open docs
              </a>
              <a href={repositoryUrl} target="_blank" rel="noreferrer" style={actionStyle}>
                GitHub
              </a>
            </div>
          </ExampleCard>
        </ExampleGrid>
      </PageSection>
      {demoSections.map((section) => (
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
