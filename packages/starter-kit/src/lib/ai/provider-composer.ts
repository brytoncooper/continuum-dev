import {
  createAnthropicClient,
  createGoogleClient,
  createOpenAiClient,
  type AiConnectClient,
  type AnthropicClientOptions,
  type GoogleClientOptions,
  type OpenAiClientOptions,
} from '@continuum-dev/ai-connect';

export type StarterKitProviderKey = 'openai' | 'anthropic' | 'google';

export interface StarterKitProviderComposerArgs {
  include: StarterKitProviderKey[];
  openai?: Partial<OpenAiClientOptions>;
  anthropic?: Partial<AnthropicClientOptions>;
  google?: Partial<GoogleClientOptions>;
}

function requiredApiKey(provider: StarterKitProviderKey): string {
  switch (provider) {
    case 'openai':
      return 'openai.apiKey';
    case 'anthropic':
      return 'anthropic.apiKey';
    default:
      return 'google.apiKey';
  }
}

export function createStarterKitProviders(
  args: StarterKitProviderComposerArgs
): AiConnectClient[] {
  if (!args.include || args.include.length === 0) {
    throw new Error(
      'createStarterKitProviders requires at least one provider in include.'
    );
  }

  return args.include.map((provider) => {
    if (provider === 'openai') {
      const config = args.openai;
      if (!config?.apiKey) {
        throw new Error(`Missing required config: ${requiredApiKey(provider)}`);
      }
      return createOpenAiClient({
        ...config,
        apiKey: config.apiKey,
      });
    }

    if (provider === 'anthropic') {
      const config = args.anthropic;
      if (!config?.apiKey) {
        throw new Error(`Missing required config: ${requiredApiKey(provider)}`);
      }
      return createAnthropicClient({
        ...config,
        apiKey: config.apiKey,
      });
    }

    const config = args.google;
    if (!config?.apiKey) {
      throw new Error(`Missing required config: ${requiredApiKey(provider)}`);
    }
    return createGoogleClient({
      ...config,
      apiKey: config.apiKey,
    });
  });
}

export const StarterKitProviderComposer = createStarterKitProviders;
