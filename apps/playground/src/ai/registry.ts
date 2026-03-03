import type { AIProvider, ProviderId } from './types';
import { anthropicProvider } from './providers/anthropic';
import { googleProvider } from './providers/google';
import { openAIProvider } from './providers/openai';

export const aiProviders: AIProvider[] = [openAIProvider, googleProvider, anthropicProvider];

export function getProviderById(id: ProviderId): AIProvider | undefined {
  return aiProviders.find((provider) => provider.id === id);
}
