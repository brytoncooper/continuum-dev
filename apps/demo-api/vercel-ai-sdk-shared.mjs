import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';

export const VERCEL_AI_SDK_DEMO_PATH = '/api/vercel-ai-sdk/demo';
export const VERCEL_AI_SDK_LEGACY_DEMO_PATH = '/api/vercel-ai-sdk-demo';
export const VERCEL_AI_SDK_LIVE_PATH = '/api/vercel-ai-sdk/chat';
export const VERCEL_AI_SDK_PROVIDERS_PATH = '/api/vercel-ai-sdk/providers';
export const VERCEL_AI_SDK_API_KEY_HEADER = 'x-demo-provider-api-key';

const PROVIDER_CATALOG = [
  {
    id: 'openai',
    label: 'OpenAI',
    tokenLabel: 'OpenAI API key',
    defaultModel: 'gpt-5',
    models: ['gpt-5', 'gpt-5-mini', 'gpt-5.4', 'gpt-5-nano'],
    envKey: 'OPENAI_API_KEY',
  },
  {
    id: 'anthropic',
    label: 'Anthropic Claude',
    tokenLabel: 'Anthropic API key',
    defaultModel: 'claude-sonnet-4-6',
    models: ['claude-sonnet-4-6', 'claude-haiku-4-5', 'claude-opus-4-6'],
    envKey: 'ANTHROPIC_API_KEY',
  },
];

const providerCatalogById = new Map(
  PROVIDER_CATALOG.map((provider) => [provider.id, provider])
);

export function isVercelAiSdkDemoPath(pathname) {
  return (
    pathname === VERCEL_AI_SDK_DEMO_PATH ||
    pathname === VERCEL_AI_SDK_LEGACY_DEMO_PATH
  );
}

export function isVercelAiSdkLivePath(pathname) {
  return pathname === VERCEL_AI_SDK_LIVE_PATH;
}

export function isVercelAiSdkProvidersPath(pathname) {
  return pathname === VERCEL_AI_SDK_PROVIDERS_PATH;
}

export function jsonResponse(payload, init = {}) {
  const headers = new Headers(init.headers);
  if (!headers.has('content-type')) {
    headers.set('content-type', 'application/json; charset=utf-8');
  }

  return new Response(JSON.stringify(payload), {
    ...init,
    headers,
  });
}

export function methodNotAllowed(allowedMethods) {
  return new Response('Method Not Allowed', {
    status: 405,
    headers: {
      allow: Array.isArray(allowedMethods)
        ? allowedMethods.join(', ')
        : allowedMethods,
    },
  });
}

function textFromPart(part) {
  if (!part || typeof part !== 'object') {
    return '';
  }

  if (part.type === 'text' && typeof part.text === 'string') {
    return part.text;
  }

  return '';
}

export function extractLatestUserInstruction(messages) {
  if (!Array.isArray(messages)) {
    return '';
  }

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message || typeof message !== 'object' || message.role !== 'user') {
      continue;
    }

    if (typeof message.content === 'string' && message.content.trim()) {
      return message.content.trim();
    }

    if (!Array.isArray(message.parts)) {
      continue;
    }

    const combined = message.parts
      .map((part) => textFromPart(part))
      .join(' ')
      .trim();

    if (combined) {
      return combined;
    }
  }

  return '';
}

export function getPublicProviderCatalog(env = {}) {
  return PROVIDER_CATALOG.map((provider) => ({
    id: provider.id,
    label: provider.label,
    tokenLabel: provider.tokenLabel,
    defaultModel: provider.defaultModel,
    models: provider.models,
    serverKeyAvailable:
      typeof env[provider.envKey] === 'string' &&
      env[provider.envKey].trim().length > 0,
  }));
}

export function resolveLiveProvider(args) {
  const provider = providerCatalogById.get(args.providerId);
  if (!provider) {
    throw new Error(`Unsupported provider "${String(args.providerId)}".`);
  }

  const requestKey =
    args.headers?.get(VERCEL_AI_SDK_API_KEY_HEADER)?.trim() ?? '';

  if (requestKey && /\s/.test(requestKey)) {
    throw new Error(
      `${provider.label} live mode expected an API key, but the supplied value contains whitespace.`
    );
  }

  const envKey =
    typeof args.env?.[provider.envKey] === 'string'
      ? args.env[provider.envKey].trim()
      : '';
  const apiKey = requestKey || envKey;

  if (!apiKey) {
    throw new Error(
      `${provider.label} live mode requires an API key. Add one in the demo controls or configure ${provider.envKey} in the Worker.`
    );
  }

  const modelId =
    typeof args.model === 'string' && args.model.trim().length > 0
      ? args.model.trim()
      : provider.defaultModel;

  if (provider.id === 'openai') {
    const openai = createOpenAI({ apiKey });
    return {
      provider,
      modelId,
      languageModel: openai(modelId),
      keySource: requestKey ? 'request' : 'env',
    };
  }

  const anthropic = createAnthropic({ apiKey });
  return {
    provider,
    modelId,
    languageModel: anthropic(modelId),
    keySource: requestKey ? 'request' : 'env',
  };
}
