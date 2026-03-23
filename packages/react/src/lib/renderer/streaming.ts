import { useMemo } from 'react';
import type { SessionStream } from '@continuum-dev/core';
import type {
  ContinuumNodeBuildState,
  ContinuumNodeStreamStatus,
} from '../types.js';
import { useContinuumStreaming } from '../hooks/streams.js';
import { isNodeWithinScope } from './paths.js';

export function resolveStreamStatus(
  activeStream: SessionStream | null,
  nodeId: string
): ContinuumNodeStreamStatus | undefined {
  if (!activeStream) {
    return undefined;
  }

  const exact = activeStream.nodeStatuses[nodeId];
  if (exact) {
    return exact;
  }

  const segments = nodeId.split('/');
  while (segments.length > 1) {
    segments.pop();
    const ancestorId = segments.join('/');
    const status = activeStream.nodeStatuses[ancestorId];
    if (status?.subtree) {
      return status;
    }
  }

  return undefined;
}

export function deriveNodeBuildState(
  activeStream: SessionStream | null,
  nodeId: string,
  streamStatus: ContinuumNodeStreamStatus | undefined
): ContinuumNodeBuildState {
  if (!activeStream) {
    return 'committed';
  }

  if (streamStatus?.level === 'error' || streamStatus?.status === 'error') {
    return 'error';
  }

  if (streamStatus?.status === 'ready') {
    return 'ready';
  }

  if (streamStatus?.status === 'committed') {
    return 'committed';
  }

  if (
    streamStatus ||
    activeStream.affectedNodeIds.some((affectedNodeId) =>
      isNodeWithinScope(nodeId, affectedNodeId)
    )
  ) {
    return 'building';
  }

  return 'committed';
}

export function useStreamingMappedProps(
  canonicalId: string,
  mappedProps?: Record<string, unknown>
): Record<string, unknown> {
  const { activeStream, isStreaming } = useContinuumStreaming();
  const streamStatus = resolveStreamStatus(activeStream, canonicalId);
  const buildState = deriveNodeBuildState(
    activeStream,
    canonicalId,
    streamStatus
  );

  return useMemo(
    () => ({
      isStreaming: isStreaming && buildState !== 'committed',
      buildState,
      ...(streamStatus ? { streamStatus } : {}),
      ...(mappedProps ?? {}),
    }),
    [buildState, isStreaming, mappedProps, streamStatus]
  );
}
