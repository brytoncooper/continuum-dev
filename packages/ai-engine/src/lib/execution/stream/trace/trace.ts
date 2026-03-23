import type {
  ContinuumChatAttachment,
  ContinuumExecutionAdapter,
  ContinuumExecutionRequest,
  ContinuumExecutionResponse,
  ContinuumExecutionTraceEntry,
} from '../../types.js';

export function redactExecutionRequestForTrace(
  request: ContinuumExecutionRequest
): ContinuumExecutionRequest {
  const attachments = request.attachments;
  if (!attachments?.length) {
    return request;
  }
  return {
    ...request,
    attachments: attachments.map((attachment) => ({
      ...attachment,
      base64: `[base64 ${attachment.base64.length} chars]`,
    })),
  };
}

export function mergeRequestAttachments(
  request: ContinuumExecutionRequest,
  attachments: ContinuumChatAttachment[] | undefined
): ContinuumExecutionRequest {
  if (!attachments?.length) {
    return request;
  }
  return { ...request, attachments };
}

export function toTraceEntry(
  phase: ContinuumExecutionRequest['mode'],
  request: ContinuumExecutionRequest,
  response: ContinuumExecutionResponse
): ContinuumExecutionTraceEntry {
  return {
    phase,
    request: redactExecutionRequestForTrace(request),
    response,
  };
}

export async function runGenerate(
  adapter: ContinuumExecutionAdapter,
  request: ContinuumExecutionRequest,
  trace: ContinuumExecutionTraceEntry[]
): Promise<ContinuumExecutionResponse> {
  const response = await adapter.generate(request);
  trace.push(toTraceEntry(request.mode, request, response));
  return response;
}
