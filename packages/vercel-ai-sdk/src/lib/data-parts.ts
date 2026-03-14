import type {
  ContinuumVercelAiSdkDataChunk,
  ContinuumVercelAiSdkDataPart,
  ContinuumVercelAiSdkPatchData,
  ContinuumVercelAiSdkResetData,
  ContinuumVercelAiSdkStateData,
  ContinuumVercelAiSdkStatusData,
  ContinuumVercelAiSdkViewData,
} from './types.js';

const CONTINUUM_DATA_TYPES = new Set([
  'data-continuum-view',
  'data-continuum-patch',
  'data-continuum-state',
  'data-continuum-reset',
  'data-continuum-status',
]);

export interface ContinuumVercelAiSdkDataChunkOptions {
  id?: string;
  transient?: boolean;
}

export function createContinuumVercelAiSdkViewDataChunk(
  data: ContinuumVercelAiSdkViewData,
  options?: ContinuumVercelAiSdkDataChunkOptions
): Extract<ContinuumVercelAiSdkDataChunk, { type: 'data-continuum-view' }> {
  return {
    type: 'data-continuum-view',
    data,
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
    data,
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
    data,
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
    data,
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
