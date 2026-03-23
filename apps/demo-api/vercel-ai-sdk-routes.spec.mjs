import {
  handleVercelAiSdkLiveRequest,
} from './vercel-ai-sdk-live-route.mjs';
import {
  handleVercelAiSdkProvidersRequest,
} from './vercel-ai-sdk-providers-route.mjs';

describe('demo-api Vercel AI SDK routes', () => {
  it('returns provider catalog metadata from the providers route', async () => {
    const response = await handleVercelAiSdkProvidersRequest(
      new Request('http://localhost/api/vercel-ai-sdk/providers', {
        method: 'GET',
      }),
      {}
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.apiKeyHeader).toBe('x-demo-provider-api-key');
    expect(Array.isArray(payload.providers)).toBe(true);
    expect(payload.providers.length).toBeGreaterThan(0);
  });

  it('returns a contract-level validation error when live requests have no instruction', async () => {
    const response = await handleVercelAiSdkLiveRequest(
      new Request('http://localhost/api/vercel-ai-sdk/chat', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          messages: [],
        }),
      }),
      {}
    );

    expect(response.status).toBe(400);
    await expect(response.text()).resolves.toContain(
      'Add an instruction before sending a live Vercel AI SDK request.'
    );
  });
});
