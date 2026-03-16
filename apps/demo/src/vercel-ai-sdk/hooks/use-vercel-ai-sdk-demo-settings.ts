import { useEffect, useMemo, useState } from 'react';

const VERCEL_AI_SDK_SETTINGS_STORAGE_KEY =
  'continuum_demo_vercel_ai_sdk_settings_v2';

export const VERCEL_AI_SDK_API_KEY_HEADER = 'x-demo-provider-api-key';

export type DemoMode = 'mock' | 'live';
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
  mode?: DemoMode;
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
    defaultModel: 'gpt-5',
    models: ['gpt-5', 'gpt-5-mini', 'gpt-5.4', 'gpt-5-nano'],
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

function normalizeProvidersPayload(payload: unknown): DemoProviderOption[] | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const providers = (payload as ProvidersPayload).providers;
  if (!Array.isArray(providers)) {
    return null;
  }

  const normalized = providers.filter((provider): provider is DemoProviderOption => {
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
  });

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
  mode: DemoMode;
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
  setMode(mode: DemoMode): void;
  setProviderId(providerId: DemoProviderId): void;
  setApiKey(apiKey: string): void;
  setModel(model: string): void;
}

export function useVercelAiSdkDemoSettings(): UseVercelAiSdkDemoSettingsResult {
  const storedSettings = useMemo(() => readStoredSettings(), []);
  const [mode, setMode] = useState<DemoMode>(storedSettings.mode ?? 'mock');
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
  const [providerCatalog, setProviderCatalog] =
    useState<DemoProviderOption[]>(fallbackProviderCatalog);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const payload: StoredSettings = {
      mode,
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
  }, [apiKeysByProvider, mode, modelsByProvider, providerId]);

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

  const selectedProvider =
    providerCatalog.find((provider) => provider.id === providerId) ??
    fallbackProviderCatalog[0];
  const activeApiKey = apiKeysByProvider[providerId] ?? '';
  const trimmedApiKey = activeApiKey.trim();
  const apiKeyValidationMessage = getApiKeyValidationMessage(activeApiKey);
  const hasUsableBrowserKey =
    trimmedApiKey.length > 0 && apiKeyValidationMessage === null;
  const selectedModel = modelsByProvider[providerId] ?? '';
  const resolvedModel = selectedModel.trim() || selectedProvider.defaultModel;
  const hasLiveAccess =
    selectedProvider.serverKeyAvailable || hasUsableBrowserKey;
  const liveStatusText =
    mode === 'mock'
      ? 'Mock mode is deterministic and free. It shows the stream/session contract without asking for a key.'
      : apiKeyValidationMessage
        ? apiKeyValidationMessage
        : hasUsableBrowserKey
          ? 'Live mode will send your browser key to the Worker for this request only. The key stays in localStorage on this device.'
          : selectedProvider.serverKeyAvailable
            ? 'Live mode can use the Worker-configured provider secret. Add your own key if you want to override it.'
            : `Live mode is disabled until you add a ${selectedProvider.tokenLabel.toLowerCase()}.`;

  return {
    mode,
    providerId,
    providerCatalog,
    selectedProvider,
    activeApiKey,
    trimmedApiKey,
    selectedModel,
    resolvedModel,
    apiKeyValidationMessage,
    hasUsableBrowserKey,
    hasLiveAccess,
    isChatLocked: mode === 'live' && !hasLiveAccess,
    liveStatusText,
    setMode,
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
