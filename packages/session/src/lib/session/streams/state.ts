import type { SessionStream } from '../../types.js';
import type { SessionState } from '../state/index.js';
import type { InternalSessionStreamState } from './types.js';

export function getActiveForegroundStream(
  internal: SessionState
): InternalSessionStreamState | null {
  if (!internal.activeForegroundStreamId) {
    return null;
  }

  const stream = internal.streams.get(internal.activeForegroundStreamId);
  if (!stream || stream.status !== 'open' || stream.mode !== 'foreground') {
    internal.activeForegroundStreamId = null;
    return null;
  }

  return stream;
}

export function toPublicSessionStream(
  stream: InternalSessionStreamState
): SessionStream {
  return {
    streamId: stream.streamId,
    source: stream.source,
    targetViewId: stream.targetViewId,
    baseViewVersion: stream.baseViewVersion,
    mode: stream.mode,
    status: stream.status,
    startedAt: stream.startedAt,
    updatedAt: stream.updatedAt,
    latestStatus: stream.latestStatus,
    nodeStatuses: { ...stream.nodeStatuses },
    previewData: stream.workingData
      ? structuredClone(stream.workingData)
      : null,
    previewView: stream.workingView
      ? structuredClone(stream.workingView)
      : null,
    viewVersion: stream.workingView?.version ?? null,
    affectedNodeIds: [...stream.affectedNodeIds],
    partCount: stream.parts.length,
  };
}
