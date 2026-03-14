import {
  VERCEL_AI_SDK_API_KEY_HEADER,
  VERCEL_AI_SDK_PROVIDERS_PATH,
  getPublicProviderCatalog,
  isVercelAiSdkProvidersPath,
  jsonResponse,
  methodNotAllowed,
} from './vercel-ai-sdk-shared.mjs';

export { isVercelAiSdkProvidersPath };

export { VERCEL_AI_SDK_PROVIDERS_PATH };

export async function handleVercelAiSdkProvidersRequest(request, env = {}) {
  if (request.method !== 'GET') {
    return methodNotAllowed('GET');
  }

  return jsonResponse({
    apiKeyHeader: VERCEL_AI_SDK_API_KEY_HEADER,
    providers: getPublicProviderCatalog(env),
  });
}
