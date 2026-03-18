import { createAiConnectProviders } from './provider-composer.js';

describe('createAiConnectProviders', () => {
  it('throws when no providers are included', () => {
    expect(() => createAiConnectProviders({ include: [] })).toThrow(
      'createAiConnectProviders requires at least one provider in include.'
    );
  });

  it('creates the requested providers in order with defaults and overrides', () => {
    const providers = createAiConnectProviders({
      include: ['anthropic', 'openai', 'google'],
      anthropic: {
        apiKey: 'anthropic-key',
        label: 'Anthropic Custom',
      },
      openai: {
        apiKey: 'openai-key',
        id: 'openai-primary',
        model: 'gpt-5-mini',
      },
      google: {
        apiKey: 'google-key',
        model: 'gemini-2.5-pro',
      },
    });

    expect(
      providers.map((provider) => ({
        id: provider.id,
        kind: provider.kind,
        label: provider.label,
        defaultModel: provider.defaultModel,
        supportsJsonSchema: provider.supportsJsonSchema,
      }))
    ).toEqual([
      {
        id: 'anthropic',
        kind: 'anthropic',
        label: 'Anthropic Custom',
        defaultModel: 'claude-sonnet-4-6',
        supportsJsonSchema: true,
      },
      {
        id: 'openai-primary',
        kind: 'openai',
        label: 'OpenAI',
        defaultModel: 'gpt-5-mini',
        supportsJsonSchema: true,
      },
      {
        id: 'google',
        kind: 'google',
        label: 'Google Gemini',
        defaultModel: 'gemini-2.5-pro',
        supportsJsonSchema: true,
      },
    ]);
  });
});
