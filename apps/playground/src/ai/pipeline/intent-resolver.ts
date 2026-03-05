import { getProviderById } from '../registry';
import type { ProviderId } from '../types';
import { getSchemaIndex } from '../schema-api';

export async function resolveIntent(
  providerId: ProviderId,
  model: string,
  apiKey: string,
  prompt: string
): Promise<string[]> {
  const provider = getProviderById(providerId);
  if (!provider) throw new Error(`Unknown provider: ${providerId}`);

  const index = getSchemaIndex();
  
  const systemPrompt = `You are the Intent Resolver. Your job is to analyze the user request and determine which node types are needed to fulfill it.
Available node types: ${index.types.join(', ')}

Return a JSON array of strings containing ONLY the node type names required. Do not return anything else.`;

  const response = await provider.generate({
    apiKey,
    model,
    systemPrompt,
    messages: [{ role: 'user', content: prompt }],
  });

  try {
    let raw = response.rawResponse.trim();
    if (raw.startsWith('```json')) {
      raw = raw.replace(/^```json/, '').replace(/```$/, '').trim();
    }
    const result = JSON.parse(raw);
    if (Array.isArray(result)) {
      return result.filter(type => index.types.includes(type));
    }
    return [];
  } catch {
    return [];
  }
}
