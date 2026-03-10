import {
  createGoogleClient,
  type AiConnectClient,
  type GoogleClientOptions,
} from '@continuum-dev/ai-connect';

export type StarterKitGoogleProviderConfig = Pick<
  GoogleClientOptions,
  'apiKey'
> &
  Partial<Omit<GoogleClientOptions, 'apiKey'>>;

export function createStarterKitGoogleProvider(
  config: StarterKitGoogleProviderConfig
): AiConnectClient {
  if (!config.apiKey) {
    throw new Error('Missing required config: google.apiKey');
  }

  return createGoogleClient({
    ...config,
    apiKey: config.apiKey,
  });
}
