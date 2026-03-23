import {
  handleHeadlessAiReferenceRequest,
  headlessAiReferenceServerPackages,
} from './reference-headless-ai-route.mjs';

describe('headless AI reference route', () => {
  it('exports the reference server package list', () => {
    expect(headlessAiReferenceServerPackages).toContain('@continuum-dev/ai-engine');
    expect(headlessAiReferenceServerPackages).toContain(
      '@continuum-dev/vercel-ai-sdk-adapter'
    );
  });

  it('returns a validation error when no instruction is provided', async () => {
    const response = await handleHeadlessAiReferenceRequest(
      new Request('http://localhost/api/reference-headless-ai', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          messages: [],
        }),
      })
    );

    expect(response.status).toBe(400);
    await expect(response.text()).resolves.toContain(
      'Add an instruction before running the headless AI reference route.'
    );
  });
});
