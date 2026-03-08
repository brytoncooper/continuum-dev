import type {
  AiConnectClient,
  AiConnectGenerateArgs,
  AiConnectGenerateResult,
} from './types.js';

export interface AiConnectRegistry {
  list(): AiConnectClient[];
  get(providerId: string): AiConnectClient;
  generate<TJson = unknown>(
    args: AiConnectGenerateArgs
  ): Promise<AiConnectGenerateResult<TJson>>;
}

export function createAiConnectRegistry(
  providers: AiConnectClient[]
): AiConnectRegistry {
  if (providers.length === 0) {
    throw new Error('createAiConnectRegistry requires at least one provider');
  }

  const providerMap = new Map<string, AiConnectClient>();
  for (const provider of providers) {
    if (providerMap.has(provider.id)) {
      throw new Error(`Duplicate provider id "${provider.id}"`);
    }
    providerMap.set(provider.id, provider);
  }

  return {
    list() {
      return [...providerMap.values()];
    },
    get(providerId: string) {
      const provider = providerMap.get(providerId);
      if (!provider) {
        throw new Error(`Unknown provider id "${providerId}"`);
      }
      return provider;
    },
    async generate<TJson = unknown>(args: AiConnectGenerateArgs) {
      const provider = providerMap.get(args.providerId);
      if (!provider) {
        throw new Error(`Unknown provider id "${args.providerId}"`);
      }
      return provider.generate<TJson>(args.request);
    },
  };
}
