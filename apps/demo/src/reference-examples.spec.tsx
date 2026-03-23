import {
  HeadlessAiReferenceApp,
  headlessAiReferenceClientPackages,
} from './reference-headless-ai-app';
import {
  StarterReferenceApp,
  starterReferencePackages,
} from './reference-starter-app';

describe('adoption reference examples', () => {
  it('exports the starter reference app', () => {
    expect(typeof StarterReferenceApp).toBe('function');
    expect(starterReferencePackages).toContain('@continuum-dev/starter-kit');
  });

  it('exports the headless AI reference app', () => {
    expect(typeof HeadlessAiReferenceApp).toBe('function');
    expect(headlessAiReferenceClientPackages).toContain('@continuum-dev/react');
    expect(headlessAiReferenceClientPackages).toContain(
      '@continuum-dev/vercel-ai-sdk-adapter'
    );
  });
});
