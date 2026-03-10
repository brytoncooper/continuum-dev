import {
  createAnthropicClient,
  type AiConnectClient,
  type AnthropicClientOptions,
} from '@continuum-dev/ai-connect';

export type StarterKitAnthropicProviderConfig = Pick<
  AnthropicClientOptions,
  'apiKey'
> &
  Partial<Omit<AnthropicClientOptions, 'apiKey'>>;

export function createStarterKitAnthropicProvider(
  config: StarterKitAnthropicProviderConfig
): AiConnectClient {
  if (!config.apiKey) {
    throw new Error('Missing required config: anthropic.apiKey');
  }

  return createAnthropicClient({
    ...config,
    apiKey: config.apiKey,
  });
}
