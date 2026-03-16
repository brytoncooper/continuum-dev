import {
  ContinuumProvider,
  starterKitComponentMap,
} from '@continuum-dev/starter-kit';
import { ExampleCard, ExampleGrid, PageSection, PageShell } from '../ui/layout';
import { repositoryUrl } from '../site-config';
import { SiteNav } from '../ui/site-nav';
import { color, radius, space, type } from '../ui/tokens';
import {
  VERCEL_AI_SDK_SESSION_STORAGE_KEY,
} from './data/initial-view';
import { VercelAiSdkAdvancedLayers } from './components/vercel-ai-sdk-advanced-layers';
import { VercelAiSdkStudio } from './components/vercel-ai-sdk-studio';

const helperTextStyle = {
  ...type.small,
  color: color.textMuted,
} as const;

const linkRowStyle = {
  display: 'flex',
  flexWrap: 'wrap' as const,
  gap: space.sm,
  marginBottom: space.md,
} as const;

const inlineLinkStyle = {
  ...type.small,
  color: color.text,
  textDecoration: 'none',
  padding: `${space.sm}px ${space.md}px`,
  borderRadius: radius.pill,
  border: `1px solid ${color.border}`,
  background: color.surfaceMuted,
} as const;

export function VercelAiSdkPage() {
  return (
    <PageShell
      nav={<SiteNav />}
      eyebrow="Vercel AI SDK Demo"
      title="Start with the wrapper. Keep the transport. Outgrow it without rewriting everything."
      description="This demo now leads with the starter-kit happy path for Vercel AI SDK users, then shows the raw hook, Worker boundary, and draft preview layers underneath."
    >
      <PageSection
        title="Why this integration exists"
        description="The point is not to make Vercel AI SDK users learn a giant new stack. The point is to let them keep the transport they already trust and add a continuity runtime that stays stable when the UI changes."
      >
        <ExampleGrid alignItems="stretch">
          <ExampleCard
            title="Starter-kit first"
            description="The default lane is intentionally simple: drop in the starter preset, wire the transport, and get a stable runtime plus session workbench immediately."
            span={4}
          >
            <div style={helperTextStyle}>
              Fast setup first. Deeper customization later.
            </div>
          </ExampleCard>
          <ExampleCard
            title="Vercel stays Vercel"
            description="Continuum is not replacing the Vercel AI SDK. It starts after the stream lands and keeps evolving forms and workflows from wiping real user work."
            span={4}
          >
            <div style={helperTextStyle}>
              Transport and tools on one side. Runtime continuity on the other.
            </div>
          </ExampleCard>
          <ExampleCard
            title="Easy to outgrow"
            description="When teams need custom orchestration or custom UI, they can peel away the wrapper and keep the same runtime and transport contract instead of starting over."
            span={4}
          >
            <div style={helperTextStyle}>
              The wrapper is a ramp, not a trap.
            </div>
          </ExampleCard>
        </ExampleGrid>
      </PageSection>

      <PageSection
        title="Starter-kit happy path"
        description="Prompt on the left, inspect the stable runtime on the right, and use the session workbench to rewind. Mock mode stays deterministic. Live mode uses BYOK or a Worker secret if you configure one privately."
      >
        <div style={linkRowStyle}>
          <a href={repositoryUrl} target="_blank" rel="noreferrer" style={inlineLinkStyle}>
            View on GitHub
          </a>
          <a href="/docs" style={inlineLinkStyle}>
            Install / Read docs
          </a>
          <a href="/live-ai" style={inlineLinkStyle}>
            Provider chat demo
          </a>
          <a href="/playground" style={inlineLinkStyle}>
            Static continuity demo
          </a>
        </div>
        <ContinuumProvider
          components={starterKitComponentMap}
          persist="localStorage"
          storageKey={VERCEL_AI_SDK_SESSION_STORAGE_KEY}
        >
          <VercelAiSdkStudio />
        </ContinuumProvider>
      </PageSection>

      <PageSection
        title="Advanced layers"
        description="The simple setup is the default story, but the deeper layers are still here. Use them when you need custom chat UI, lower-level hook control, or a more explicit server pipeline."
      >
        <VercelAiSdkAdvancedLayers />
      </PageSection>
    </PageShell>
  );
}
