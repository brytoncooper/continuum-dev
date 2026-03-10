import { SiteNav } from '../ui/site-nav';
import { ClosingCtaBlock } from './blocks/closing-cta-block';
import { CtaBlock } from './blocks/cta-block';
import { ContinuityBlock } from './blocks/continuity-block';
import { FeatureListBlock } from './blocks/feature-list-block';
import { HeroBlock } from './blocks/hero-block';
import { HowItWorksBlock } from './blocks/how-it-works-block';
import { PackageStackBlock } from './blocks/package-stack-block';
import { ProblemBlock } from './blocks/problem-block';
import { UseCasesBlock } from './blocks/use-cases-block';
import { heroContent } from './content/landing-content';
import { LandingShell } from './landing-layout';

export function LandingPage() {
  return (
    <LandingShell
      nav={<SiteNav />}
      eyebrow={heroContent.eyebrow}
      title={heroContent.title}
      description={heroContent.description}
    >
      <HeroBlock />
      <ProblemBlock />
      <CtaBlock />
      <FeatureListBlock />
      <HowItWorksBlock />
      <ContinuityBlock />
      <PackageStackBlock />
      <UseCasesBlock />
      <ClosingCtaBlock />
    </LandingShell>
  );
}
