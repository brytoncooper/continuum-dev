import {
  ContinuumProvider,
  starterKitComponentMap,
} from '@continuum-dev/starter-kit';
import { PageShell } from '../ui/layout';
import { repositoryUrl } from '../site-config';
import { SiteNav } from '../ui/site-nav';
import { color, radius, space, type } from '../ui/tokens';
import { financialPlanningSessionActions } from './data/financial-planning-actions';
import { VERCEL_AI_SDK_SESSION_STORAGE_KEY } from './data/initial-view';
import { VercelAiSdkStudio } from './components/vercel-ai-sdk-studio';

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

const demoWrapStyle = {
  display: 'grid',
  gap: space.lg,
} as const;

export function VercelAiSdkPage() {
  return (
    <PageShell
      nav={<SiteNav />}
      eyebrow="Vercel AI SDK adapter"
      title="Already using Vercel AI SDK? Add stable Continuum state."
      description="Keep useChat, your transport, route handlers, and model setup. Continuum plugs into the Vercel AI SDK so generated UI can evolve without wiping the state users already entered."
    >
      <div style={demoWrapStyle}>
        <div style={linkRowStyle}>
          <a
            href={repositoryUrl}
            target="_blank"
            rel="noreferrer"
            style={inlineLinkStyle}
          >
            View on GitHub
          </a>
          <a href="/docs" style={inlineLinkStyle}>
            Read docs
          </a>
        </div>
        <ContinuumProvider
          components={starterKitComponentMap}
          persist="localStorage"
          storageKey={VERCEL_AI_SDK_SESSION_STORAGE_KEY}
          sessionOptions={{
            enableRestoreReviews: false,
            actions: financialPlanningSessionActions,
          }}
        >
          <VercelAiSdkStudio />
        </ContinuumProvider>
      </div>
    </PageShell>
  );
}
