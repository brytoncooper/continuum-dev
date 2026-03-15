import { SiteNav } from '../ui/site-nav';
import { ClosingCtaBlock } from './blocks/closing-cta-block';
import { HeroBlock } from './blocks/hero-block';
import { HowItWorksBlock } from './blocks/how-it-works-block';
import { ProblemBlock } from './blocks/problem-block';
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
      <HowItWorksBlock />
      <ClosingCtaBlock />
    </LandingShell>
  );
}
