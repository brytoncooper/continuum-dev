import { useEffect, useMemo, useState } from 'react';

const VERCEL_AI_SDK_SETTINGS_STORAGE_KEY =
  'continuum_demo_vercel_ai_sdk_settings_v2';

export const VERCEL_AI_SDK_API_KEY_HEADER = 'x-demo-provider-api-key';
const OPENAI_FIXED_MODEL = 'gpt-5.4';

export type DemoProviderId = 'openai' | 'anthropic';

export interface DemoProviderOption {
  id: DemoProviderId;
  label: string;
  tokenLabel: string;
  defaultModel: string;
  models: string[];
  serverKeyAvailable: boolean;
}

interface ProvidersPayload {
  providers?: DemoProviderOption[];
}

interface StoredSettings {
  providerId?: DemoProviderId;
  apiKeys?: Partial<Record<DemoProviderId, string>>;
  models?: Partial<Record<DemoProviderId, string>>;
}

type ProviderValueMap = Record<DemoProviderId, string>;

const fallbackProviderCatalog: DemoProviderOption[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    tokenLabel: 'OpenAI API key',
    defaultModel: OPENAI_FIXED_MODEL,
    models: [OPENAI_FIXED_MODEL],
    serverKeyAvailable: false,
  },
  {
    id: 'anthropic',
    label: 'Anthropic Claude',
    tokenLabel: 'Anthropic API key',
    defaultModel: 'claude-sonnet-4-6',
    models: ['claude-sonnet-4-6', 'claude-haiku-4-5', 'claude-opus-4-6'],
    serverKeyAvailable: false,
  },
];

const defaultProviderValues: ProviderValueMap = {
  openai: '',
  anthropic: '',
};

function readStoredSettings(): StoredSettings {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(VERCEL_AI_SDK_SETTINGS_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as StoredSettings;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function normalizeProvidersPayload(
  payload: unknown
): DemoProviderOption[] | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const providers = (payload as ProvidersPayload).providers;
  if (!Array.isArray(providers)) {
    return null;
  }

  const normalized = providers.filter(
    (provider): provider is DemoProviderOption => {
      if (!provider || typeof provider !== 'object') {
        return false;
      }

      const candidate = provider as Partial<DemoProviderOption>;
      return (
        (candidate.id === 'openai' || candidate.id === 'anthropic') &&
        typeof candidate.label === 'string' &&
        typeof candidate.tokenLabel === 'string' &&
        typeof candidate.defaultModel === 'string' &&
        Array.isArray(candidate.models) &&
        typeof candidate.serverKeyAvailable === 'boolean'
      );
    }
  );

  return normalized.length > 0 ? normalized : null;
}

function getApiKeyValidationMessage(rawValue: string): string | null {
  const value = rawValue.trim();

  if (!value) {
    return null;
  }

  if (/\s/.test(value)) {
    return 'This does not look like an API key. It contains whitespace, which usually means prompt text was pasted into the key field.';
  }

  if (value.length < 16) {
    return 'This value looks too short to be a provider API key.';
  }

  return null;
}

export interface UseVercelAiSdkDemoSettingsResult {
  providerId: DemoProviderId;
  providerCatalog: DemoProviderOption[];
  selectedProvider: DemoProviderOption;
  activeApiKey: string;
  trimmedApiKey: string;
  selectedModel: string;
  resolvedModel: string;
  apiKeyValidationMessage: string | null;
  hasUsableBrowserKey: boolean;
  hasLiveAccess: boolean;
  isChatLocked: boolean;
  liveStatusText: string;
  setProviderId(providerId: DemoProviderId): void;
  setApiKey(apiKey: string): void;
  setModel(model: string): void;
}

export function useVercelAiSdkDemoSettings(): UseVercelAiSdkDemoSettingsResult {
  const storedSettings = useMemo(() => readStoredSettings(), []);
  const [providerId, setProviderId] = useState<DemoProviderId>(
    storedSettings.providerId ?? 'openai'
  );
  const [apiKeysByProvider, setApiKeysByProvider] = useState<ProviderValueMap>({
    ...defaultProviderValues,
    ...(storedSettings.apiKeys ?? {}),
  });
  const [modelsByProvider, setModelsByProvider] = useState<ProviderValueMap>({
    ...defaultProviderValues,
    ...(storedSettings.models ?? {}),
  });
  const [providerCatalog, setProviderCatalog] = useState<DemoProviderOption[]>(
    fallbackProviderCatalog
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const payload: StoredSettings = {
      providerId,
      apiKeys: apiKeysByProvider,
      models: modelsByProvider,
    };

    try {
      window.localStorage.setItem(
        VERCEL_AI_SDK_SETTINGS_STORAGE_KEY,
        JSON.stringify(payload)
      );
    } catch {
      // Ignore localStorage errors in the demo.
    }
  }, [apiKeysByProvider, modelsByProvider, providerId]);

  useEffect(() => {
    let cancelled = false;

    async function loadProviderCatalog(): Promise<void> {
      try {
        const response = await fetch('/api/vercel-ai-sdk/providers');
        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as ProvidersPayload;
        const nextCatalog = normalizeProvidersPayload(payload);
        if (!cancelled && nextCatalog) {
          setProviderCatalog(nextCatalog);
        }
      } catch {
        // Fall back to the local catalog when the route is unavailable.
      }
    }

    void loadProviderCatalog();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!providerCatalog.some((provider) => provider.id === providerId)) {
      setProviderId(providerCatalog[0]?.id ?? 'openai');
    }
  }, [providerCatalog, providerId]);

  const normalizedProviderCatalog = providerCatalog.map((provider) =>
    provider.id === 'openai'
      ? {
          ...provider,
          defaultModel: OPENAI_FIXED_MODEL,
          models: [OPENAI_FIXED_MODEL],
        }
      : provider
  );

  const selectedProvider =
    normalizedProviderCatalog.find((provider) => provider.id === providerId) ??
    fallbackProviderCatalog[0];
  const activeApiKey = apiKeysByProvider[providerId] ?? '';
  const trimmedApiKey = activeApiKey.trim();
  const apiKeyValidationMessage = getApiKeyValidationMessage(activeApiKey);
  const hasUsableBrowserKey =
    trimmedApiKey.length > 0 && apiKeyValidationMessage === null;
  const selectedModel =
    providerId === 'openai'
      ? OPENAI_FIXED_MODEL
      : modelsByProvider[providerId] ?? '';
  const resolvedModel =
    providerId === 'openai'
      ? OPENAI_FIXED_MODEL
      : selectedModel.trim() || selectedProvider.defaultModel;
  const hasLiveAccess = hasUsableBrowserKey;
  const liveStatusText = apiKeyValidationMessage
    ? apiKeyValidationMessage
    : hasUsableBrowserKey
    ? 'Ready for a live request. Your key stays in localStorage on this device and is sent only with the current request.'
    : `Paste your ${selectedProvider.tokenLabel.toLowerCase()} to unlock the live demo.`;

  return {
    providerId,
    providerCatalog: normalizedProviderCatalog,
    selectedProvider,
    activeApiKey,
    trimmedApiKey,
    selectedModel,
    resolvedModel,
    apiKeyValidationMessage,
    hasUsableBrowserKey,
    hasLiveAccess,
    isChatLocked: !hasLiveAccess,
    liveStatusText,
    setProviderId,
    setApiKey: (apiKey) => {
      setApiKeysByProvider((current) => ({
        ...current,
        [providerId]: apiKey,
      }));
    },
    setModel: (model) => {
      setModelsByProvider((current) => ({
        ...current,
        [providerId]: model,
      }));
    },
  };
}
