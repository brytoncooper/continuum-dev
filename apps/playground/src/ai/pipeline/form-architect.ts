import { getProviderById } from '../registry';
import type { ProviderId } from '../types';
import type { ViewDefinition } from '@continuum/contract';
import type { FieldManifestEntry } from './data-collector';

export async function architectForm(
  providerId: ProviderId,
  model: string,
  apiKey: string,
  prompt: string,
  manifest: FieldManifestEntry[]
): Promise<ViewDefinition> {
  const provider = getProviderById(providerId);
  if (!provider) throw new Error(`Unknown provider`);

  const systemPrompt = `You are the Form Architect. Generate a valid Continuum ViewDefinition JSON.
{
  "viewId": "<stable view identifier>",
  "version": "<string version>",
  "nodes": [...]
}
Use layout nodes (group, row, grid, collection, presentation) to organize the following fields:
${JSON.stringify(manifest, null, 2)}

Return strictly JSON.`;

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
    return JSON.parse(raw);
  } catch {
    throw new Error('Failed to parse Form Architect output');
  }
}
