import type {
  ContinuumExecutionAdapter,
  ContinuumExecutionRequest,
  ContinuumExecutionResponse,
} from '@continuum-dev/ai-engine';
import type { AiConnectClient, AiConnectGenerateResult } from './types.js';

function toExecutionResponse(
  result: AiConnectGenerateResult
): ContinuumExecutionResponse {
  return {
    text: result.text,
    json: result.json,
    raw: result,
    outputContractFallbackUsed: result.outputContractFallbackUsed,
  };
}

export function createAiConnectContinuumExecutionAdapter(
  client: AiConnectClient
): ContinuumExecutionAdapter {
  return {
    label: client.label,
    async generate(
      request: ContinuumExecutionRequest
    ): Promise<ContinuumExecutionResponse> {
      const result = await client.generate({
        systemPrompt: request.systemPrompt,
        userMessage: request.userMessage,
        outputContract: request.outputContract,
        model: request.model,
        temperature: request.temperature,
        maxTokens: request.maxTokens,
      });

      return toExecutionResponse(result);
    },
  };
}
