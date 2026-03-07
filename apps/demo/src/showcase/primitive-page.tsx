import { ExampleCard, ExampleGrid, PageSection, PageShell } from '../ui/layout';
import { SiteNav } from '../ui/site-nav';
import { PrimitiveView } from './primitive-view';
import { demoSections } from './schemas';

export function PrimitivePage() {
  return (
    <PageShell
      nav={<SiteNav />}
      eyebrow="Continuum demo"
      title="A clean primitive system for schema-driven React interfaces."
      description="This first pass is intentionally quiet: every primitive is rendered inside the same black-and-white design language so alignment, hierarchy, and composability are easy to judge."
    >
      {demoSections.map((section) => (
        <PageSection key={section.title} title={section.title} description={section.description}>
          <ExampleGrid>
            {section.examples.map((example) => (
              <ExampleCard
                key={example.title}
                title={example.title}
                description={example.description}
                span={example.span ?? 6}
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
