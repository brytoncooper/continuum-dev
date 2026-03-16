import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { VercelAiSdkPage } from './vercel-ai-sdk-page';

vi.mock('@continuum-dev/starter-kit', () => ({
  ContinuumProvider: ({ children }: { children: ReactNode }) => (
    <div data-testid="continuum-provider">{children}</div>
  ),
  starterKitComponentMap: {},
}));

vi.mock('./components/vercel-ai-sdk-studio', () => ({
  VercelAiSdkStudio: () => <div>Starter kit studio</div>,
}));

vi.mock('./components/vercel-ai-sdk-advanced-layers', () => ({
  VercelAiSdkAdvancedLayers: () => <div>Advanced tab content</div>,
}));

describe('VercelAiSdkPage', () => {
  it('keeps the starter-kit-first lane ahead of the advanced layers', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/vercel-ai-sdk']}>
        <VercelAiSdkPage />
      </MemoryRouter>
    );

    expect(html).toContain('Starter-kit happy path');
    expect(html).toContain('Advanced layers');
    expect(html).toContain('Starter-kit first');
    expect(html).toContain('View on GitHub');
    expect(html).toContain('Starter kit studio');
    expect(html).toContain('Advanced tab content');
  });
});
