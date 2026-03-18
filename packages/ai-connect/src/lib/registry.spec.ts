import type { AiConnectClient, AiConnectGenerateRequest } from './types.js';
import { createAiConnectRegistry } from './registry.js';

function createProvider(id: string) {
  const generate = vi.fn(async (request: AiConnectGenerateRequest) => ({
    providerId: id,
    model: `${id}-model`,
    text: JSON.stringify({ handledBy: id }),
    json: { handledBy: id },
    raw: request,
  }));

  const provider: AiConnectClient = {
    id,
    label: `${id} label`,
    kind: id === 'google' ? 'google' : 'openai',
    defaultModel: `${id}-model`,
    supportsJsonSchema: true,
    generate: generate as AiConnectClient['generate'],
  };

  return { provider, generate };
}

describe('createAiConnectRegistry', () => {
  it('throws when no providers are registered', () => {
    expect(() => createAiConnectRegistry([])).toThrow(
      'createAiConnectRegistry requires at least one provider'
    );
  });

  it('throws when provider ids are duplicated', () => {
    const { provider } = createProvider('openai');

    expect(() => createAiConnectRegistry([provider, provider])).toThrow(
      'Duplicate provider id "openai"'
    );
  });

  it('lists providers without exposing internal registry state', () => {
    const first = createProvider('openai');
    const second = createProvider('google');
    const registry = createAiConnectRegistry([first.provider, second.provider]);

    const listedProviders = registry.list();
    listedProviders.pop();

    expect(registry.list().map((provider) => provider.id)).toEqual([
      'openai',
      'google',
    ]);
  });

  it('retrieves providers and dispatches generation to the selected client', async () => {
    const first = createProvider('openai');
    const second = createProvider('google');
    const registry = createAiConnectRegistry([first.provider, second.provider]);
    const request: AiConnectGenerateRequest = {
      systemPrompt: 'System',
      userMessage: 'User',
      model: 'gemini-2.5-pro',
    };

    expect(registry.get('google')).toBe(second.provider);

    const result = await registry.generate({
      providerId: 'google',
      request,
    });

    expect(second.generate).toHaveBeenCalledWith(request);
    expect(result).toMatchObject({
      providerId: 'google',
      model: 'google-model',
      json: { handledBy: 'google' },
    });
  });

  it('throws a clear error when looking up an unknown provider id', async () => {
    const { provider } = createProvider('openai');
    const registry = createAiConnectRegistry([provider]);

    expect(() => registry.get('missing')).toThrow('Unknown provider id "missing"');
    await expect(
      registry.generate({
        providerId: 'missing',
        request: {
          systemPrompt: 'System',
          userMessage: 'User',
        },
      })
    ).rejects.toThrow('Unknown provider id "missing"');
  });
});
