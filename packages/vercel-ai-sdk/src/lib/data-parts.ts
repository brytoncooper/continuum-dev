import type {
  ContinuumVercelAiSdkAppendContentData,
  ContinuumVercelAiSdkDataChunk,
  ContinuumVercelAiSdkDataPart,
  ContinuumVercelAiSdkInsertNodeData,
  ContinuumVercelAiSdkPatchData,
  ContinuumVercelAiSdkRemoveNodeData,
  ContinuumVercelAiSdkResetData,
  ContinuumVercelAiSdkReplaceNodeData,
  ContinuumVercelAiSdkNodeStatusData,
  ContinuumVercelAiSdkStateData,
  ContinuumVercelAiSdkStatusData,
  ContinuumVercelAiSdkViewData,
} from './types.js';
import type { SessionStreamMode } from '@continuum-dev/core';

const CONTINUUM_DATA_TYPES = new Set([
  'data-continuum-view',
  'data-continuum-patch',
  'data-continuum-insert-node',
  'data-continuum-replace-node',
  'data-continuum-remove-node',
  'data-continuum-append-content',
  'data-continuum-state',
  'data-continuum-reset',
  'data-continuum-status',
  'data-continuum-node-status',
]);

export interface ContinuumVercelAiSdkDataChunkOptions {
  id?: string;
  transient?: boolean;
  streamMode?: SessionStreamMode;
}

export function createContinuumVercelAiSdkViewDataChunk(
  data: ContinuumVercelAiSdkViewData,
  options?: ContinuumVercelAiSdkDataChunkOptions
): Extract<ContinuumVercelAiSdkDataChunk, { type: 'data-continuum-view' }> {
  return {
    type: 'data-continuum-view',
    data: {
      ...data,
      ...(options?.streamMode ? { streamMode: options.streamMode } : {}),
    },
    id: options?.id,
    transient: options?.transient,
  };
}

export function createContinuumVercelAiSdkStateDataChunk(
  data: ContinuumVercelAiSdkStateData,
  options?: ContinuumVercelAiSdkDataChunkOptions
): Extract<ContinuumVercelAiSdkDataChunk, { type: 'data-continuum-state' }> {
  return {
    type: 'data-continuum-state',
    data: {
      ...data,
      ...(options?.streamMode ? { streamMode: options.streamMode } : {}),
    },
    id: options?.id,
    transient: options?.transient,
  };
}

export function createContinuumVercelAiSdkPatchDataChunk(
  data: ContinuumVercelAiSdkPatchData,
  options?: ContinuumVercelAiSdkDataChunkOptions
): Extract<ContinuumVercelAiSdkDataChunk, { type: 'data-continuum-patch' }> {
  return {
    type: 'data-continuum-patch',
    data: {
      ...data,
      ...(options?.streamMode ? { streamMode: options.streamMode } : {}),
    },
    id: options?.id,
    transient: options?.transient,
  };
}

export function createContinuumVercelAiSdkInsertNodeDataChunk(
  data: ContinuumVercelAiSdkInsertNodeData,
  options?: ContinuumVercelAiSdkDataChunkOptions
): Extract<
  ContinuumVercelAiSdkDataChunk,
  { type: 'data-continuum-insert-node' }
> {
  return {
    type: 'data-continuum-insert-node',
    data: {
      ...data,
      ...(options?.streamMode ? { streamMode: options.streamMode } : {}),
    },
    id: options?.id,
    transient: options?.transient,
  };
}

export function createContinuumVercelAiSdkReplaceNodeDataChunk(
  data: ContinuumVercelAiSdkReplaceNodeData,
  options?: ContinuumVercelAiSdkDataChunkOptions
): Extract<
  ContinuumVercelAiSdkDataChunk,
  { type: 'data-continuum-replace-node' }
> {
  return {
    type: 'data-continuum-replace-node',
    data: {
      ...data,
      ...(options?.streamMode ? { streamMode: options.streamMode } : {}),
    },
    id: options?.id,
    transient: options?.transient,
  };
}

export function createContinuumVercelAiSdkRemoveNodeDataChunk(
  data: ContinuumVercelAiSdkRemoveNodeData,
  options?: ContinuumVercelAiSdkDataChunkOptions
): Extract<
  ContinuumVercelAiSdkDataChunk,
  { type: 'data-continuum-remove-node' }
> {
  return {
    type: 'data-continuum-remove-node',
    data: {
      ...data,
      ...(options?.streamMode ? { streamMode: options.streamMode } : {}),
    },
    id: options?.id,
    transient: options?.transient,
  };
}

export function createContinuumVercelAiSdkAppendContentDataChunk(
  data: ContinuumVercelAiSdkAppendContentData,
  options?: ContinuumVercelAiSdkDataChunkOptions
): Extract<
  ContinuumVercelAiSdkDataChunk,
  { type: 'data-continuum-append-content' }
> {
  return {
    type: 'data-continuum-append-content',
    data: {
      ...data,
      ...(options?.streamMode ? { streamMode: options.streamMode } : {}),
    },
    id: options?.id,
    transient: options?.transient,
  };
}

export function createContinuumVercelAiSdkResetDataChunk(
  data: ContinuumVercelAiSdkResetData = {},
  options?: ContinuumVercelAiSdkDataChunkOptions
): Extract<ContinuumVercelAiSdkDataChunk, { type: 'data-continuum-reset' }> {
  return {
    type: 'data-continuum-reset',
    data,
    id: options?.id,
    transient: options?.transient,
  };
}

export function createContinuumVercelAiSdkStatusDataChunk(
  data: ContinuumVercelAiSdkStatusData,
  options?: ContinuumVercelAiSdkDataChunkOptions
): Extract<ContinuumVercelAiSdkDataChunk, { type: 'data-continuum-status' }> {
  return {
    type: 'data-continuum-status',
    data: {
      ...data,
      ...(options?.streamMode ? { streamMode: options.streamMode } : {}),
    },
    id: options?.id,
    transient: options?.transient,
  };
}

export function createContinuumVercelAiSdkNodeStatusDataChunk(
  data: ContinuumVercelAiSdkNodeStatusData,
  options?: ContinuumVercelAiSdkDataChunkOptions
): Extract<
  ContinuumVercelAiSdkDataChunk,
  { type: 'data-continuum-node-status' }
> {
  return {
    type: 'data-continuum-node-status',
    data: {
      ...data,
      ...(options?.streamMode ? { streamMode: options.streamMode } : {}),
    },
    id: options?.id,
    transient: options?.transient,
  };
}

export function isContinuumVercelAiSdkDataPart(
  value: unknown
): value is ContinuumVercelAiSdkDataPart | ContinuumVercelAiSdkDataChunk {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as { type?: unknown; data?: unknown };
  return (
    typeof record.type === 'string' &&
    CONTINUUM_DATA_TYPES.has(record.type) &&
    'data' in record
  );
}
