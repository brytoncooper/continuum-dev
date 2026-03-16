import type {
  AiConnectClient,
  AiConnectProviderKind,
  AnthropicClientOptions,
  GoogleClientOptions,
  OpenAiClientOptions,
} from './types.js';
import {
  createAnthropicClient,
  createGoogleClient,
  createOpenAiClient,
} from './clients/index.js';

export type AiConnectProviderComposerArgs = {
  include: AiConnectProviderKind[];
  openai?: Partial<OpenAiClientOptions>;
  anthropic?: Partial<AnthropicClientOptions>;
  google?: Partial<GoogleClientOptions>;
};

export function createAiConnectProviders(
  args: AiConnectProviderComposerArgs
): AiConnectClient[] {
  if (!args.include || args.include.length === 0) {
    throw new Error(
      'createAiConnectProviders requires at least one provider in include.'
    );
  }

  return args.include.map((provider) => {
    if (provider === 'openai') {
      return createOpenAiClient({
        apiKey: args.openai?.apiKey ?? '',
        ...args.openai,
      });
    }

    if (provider === 'anthropic') {
      return createAnthropicClient({
        apiKey: args.anthropic?.apiKey ?? '',
        ...args.anthropic,
      });
    }

    return createGoogleClient({
      apiKey: args.google?.apiKey ?? '',
      ...args.google,
    });
  });
}

export const AiConnectProviderComposer = createAiConnectProviders;
