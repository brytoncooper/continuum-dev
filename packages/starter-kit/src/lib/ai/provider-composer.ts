import type {
  AiConnectClient,
  AnthropicClientOptions,
  GoogleClientOptions,
  OpenAiClientOptions,
} from '@continuum-dev/ai-connect';
import { createStarterKitAnthropicProvider } from './providers/anthropic.js';
import { createStarterKitGoogleProvider } from './providers/google.js';
import { createStarterKitOpenAiProvider } from './providers/openai.js';

export type StarterKitProviderKey = 'openai' | 'anthropic' | 'google';

export interface StarterKitProviderComposerArgs {
  include: StarterKitProviderKey[];
  openai?: Partial<OpenAiClientOptions>;
  anthropic?: Partial<AnthropicClientOptions>;
  google?: Partial<GoogleClientOptions>;
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
      return createStarterKitOpenAiProvider({
        apiKey: args.openai?.apiKey ?? '',
        ...args.openai,
      });
    }

    if (provider === 'anthropic') {
      return createStarterKitAnthropicProvider({
        apiKey: args.anthropic?.apiKey ?? '',
        ...args.anthropic,
      });
    }

    return createStarterKitGoogleProvider({
      apiKey: args.google?.apiKey ?? '',
      ...args.google,
    });
  });
}

export const StarterKitProviderComposer = createStarterKitProviders;
