import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@continuum-dev/starter-kit', () => ({
  ContinuumProvider: ({ children }: { children: ReactNode }) => (
    <div data-testid="continuum-provider">{children}</div>
  ),
  starterKitComponentMap: {},
}));

vi.mock('./components/vercel-ai-sdk-studio', () => ({
  VercelAiSdkStudio: () => <div>Starter kit studio</div>,
}));

describe('VercelAiSdkPage', () => {
  it('keeps the page focused on the live starter-kit demo', async () => {
    const { VercelAiSdkPage } = await import('./vercel-ai-sdk-page');
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/vercel-ai-sdk']}>
        <VercelAiSdkPage />
      </MemoryRouter>
    );

    expect(html).toContain(
      'Already using Vercel AI SDK? Add stable Continuum state.'
    );
    expect(html).toContain('View on GitHub');
    expect(html).toContain('Read docs');
    expect(html).toContain('Starter kit studio');
    expect(html).not.toContain('How to use this page');
    expect(html).not.toContain('Need more control later?');
    expect(html).not.toContain('Live demo');
  });
});
