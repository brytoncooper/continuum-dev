import type { GenerateViewRequest, GenerateViewResponse } from '../client';
import type { ViewDefinition } from '@continuum/contract';
import type { FieldManifestEntry } from './data-collector';

export type PipelineStage = 'intent' | 'collect' | 'architect' | 'done';

export async function runPipeline(
  request: GenerateViewRequest,
  onStage: (stage: PipelineStage) => void
): Promise<GenerateViewResponse> {
  onStage('intent');
  
  const lastMessage = request.messages[request.messages.length - 1];
  const prompt = typeof lastMessage.content === 'string' ? lastMessage.content : JSON.stringify(lastMessage.content);

  const intentRes = await fetch('/api/ai/pipeline', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': request.apiKey },
    body: JSON.stringify({
      provider: request.provider,
      model: request.model,
      prompt,
      stage: 'intent'
    })
  });
  if (!intentRes.ok) throw new Error('Pipeline stage intent failed');
  const nodeTypes: string[] = await intentRes.json();

  onStage('collect');
  const collectRes = await fetch('/api/ai/pipeline', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': request.apiKey },
    body: JSON.stringify({
      provider: request.provider,
      model: request.model,
      prompt,
      stage: 'collect',
      nodeTypes
    })
  });
  if (!collectRes.ok) throw new Error('Pipeline stage collect failed');
  const manifest: FieldManifestEntry[] = await collectRes.json();

  onStage('architect');
  const architectRes = await fetch('/api/ai/pipeline', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': request.apiKey },
    body: JSON.stringify({
      provider: request.provider,
      model: request.model,
      prompt,
      stage: 'architect',
      manifest
    })
  });
  if (!architectRes.ok) throw new Error('Pipeline stage architect failed');
  const view: ViewDefinition = await architectRes.json();

  onStage('done');
  return { view, rawResponse: JSON.stringify(view, null, 2) };
}
