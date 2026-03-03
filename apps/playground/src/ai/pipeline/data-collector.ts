import { getProviderById } from '../registry';
import type { ProviderId } from '../types';
import { getNodeSpec } from '../schema-api';

export interface FieldManifestEntry {
  key: string;
  type: string;
  label?: string;
  placeholder?: string;
  options?: any[];
  [key: string]: any;
}

export async function collectData(
  providerId: ProviderId,
  model: string,
  apiKey: string,
  prompt: string,
  nodeTypes: string[]
): Promise<FieldManifestEntry[]> {
  const provider = getProviderById(providerId);
  if (!provider) throw new Error(`Unknown provider`);

  const specs = nodeTypes.map(t => getNodeSpec(t)).filter(Boolean);
  
  const systemPrompt = `You are the Data Collector.
You have the following node specifications available:
${JSON.stringify(specs, null, 2)}

Analyze the user prompt and generate a field manifest.
This is an array of objects representing the specific fields needed. Each object should have a 'key', 'type', 'label', and any relevant properties based on the schema (like 'options' for select statements).
Return strictly a JSON array of these objects.`;

  const response = await provider.generate({
    apiKey,
    model,
    systemPrompt,
    messages: [{ role: 'user', content: prompt }],
  });

  try {
    let raw = response.rawResponse.trim();
    if (raw.startsWith('\`\`\`json')) {
      raw = raw.replace(/^\`\`\`json/, '').replace(/\`\`\`$/, '').trim();
    }
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}
