import {
  createOpenAiClient,
  type AiConnectClient,
  type OpenAiClientOptions,
} from '@continuum-dev/ai-connect';

export type StarterKitOpenAiProviderConfig = Pick<
  OpenAiClientOptions,
  'apiKey'
> &
  Partial<Omit<OpenAiClientOptions, 'apiKey'>>;

export function createStarterKitOpenAiProvider(
  config: StarterKitOpenAiProviderConfig
): AiConnectClient {
  if (!config.apiKey) {
    throw new Error('Missing required config: openai.apiKey');
  }

  return createOpenAiClient({
    ...config,
    apiKey: config.apiKey,
  });
}
