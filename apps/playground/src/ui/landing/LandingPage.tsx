import { HeroSection } from './HeroSection';
import { ProblemSection } from './ProblemSection';
import { SolutionSection } from './SolutionSection';
import { DeveloperSection } from './DeveloperSection';
import { ArchitectureSection } from './ArchitectureSection';
import { CTASection } from './CTASection';
import { landingTheme } from './landing-theme';

interface LandingPageProps {
  onEnter: () => void;
}

export function LandingPage({ onEnter }: LandingPageProps) {
  return (
    <main
      data-testid="landing-page"
      style={{
        overflowX: 'hidden',
        background: landingTheme.gradients.page,
        fontFamily: landingTheme.fonts.body,
      }}
    >
      <HeroSection onEnter={onEnter} />
      <ProblemSection />
      <SolutionSection />
      <DeveloperSection />
      <ArchitectureSection />
      <CTASection onEnter={onEnter} />
    </main>
  );
}
