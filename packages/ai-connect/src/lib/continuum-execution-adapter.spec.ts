import { createAiConnectContinuumExecutionAdapter } from './continuum-execution-adapter.js';
import type { AiConnectClient } from './types.js';

describe('createAiConnectContinuumExecutionAdapter', () => {
  it('forwards outputContractFallbackUsed onto ContinuumExecutionResponse', async () => {
    const client: AiConnectClient = {
      id: 'stub',
      label: 'Stub',
      kind: 'openai',
      defaultModel: 'stub-model',
      supportsJsonSchema: true,
      async generate() {
        return {
          providerId: 'stub',
          model: 'stub-model',
          text: '{"viewId":"v","version":"1","nodes":[]}',
          json: { viewId: 'v', version: '1', nodes: [] },
          raw: {},
          outputContractFallbackUsed: true,
        };
      },
    };

    const adapter = createAiConnectContinuumExecutionAdapter(client);
    const response = await adapter.generate({
      systemPrompt: 's',
      userMessage: 'u',
      mode: 'view',
    });

    expect(response.outputContractFallbackUsed).toBe(true);
    expect(response.json).toEqual({
      viewId: 'v',
      version: '1',
      nodes: [],
    });
  });

  it('leaves outputContractFallbackUsed undefined when the client omits it', async () => {
    const client: AiConnectClient = {
      id: 'stub',
      label: 'Stub',
      kind: 'openai',
      defaultModel: 'stub-model',
      supportsJsonSchema: true,
      async generate() {
        return {
          providerId: 'stub',
          model: 'stub-model',
          text: '{}',
          json: null,
          raw: {},
        };
      },
    };

    const adapter = createAiConnectContinuumExecutionAdapter(client);
    const response = await adapter.generate({
      systemPrompt: 's',
      userMessage: 'u',
      mode: 'view',
    });

    expect(response.outputContractFallbackUsed).toBeUndefined();
  });
});
