import type {
  ContinuumVercelAiSdkPartApplication,
  ContinuumVercelAiSdkSessionAdapter,
} from './types.js';

export interface PendingTurnStreams {
  commitStreamIds: Set<string>;
  previewStreamIds: Set<string>;
}

function readApplicationStreamId(
  application: ContinuumVercelAiSdkPartApplication
): string | null {
  if (
    !('streamId' in application) ||
    typeof application.streamId !== 'string' ||
    application.streamId.length === 0
  ) {
    return null;
  }

  return application.streamId;
}

function getTurnStreamDisposition(
  application: ContinuumVercelAiSdkPartApplication
): 'commit' | 'preview' | 'none' {
  switch (application.kind) {
    case 'view':
    case 'patch':
    case 'insert-node':
    case 'replace-node':
    case 'remove-node':
    case 'append-content':
    case 'state':
      return application.transient === true ? 'preview' : 'commit';
    case 'status':
    case 'node-status':
      return 'preview';
    default:
      return 'none';
  }
}

function isOpenStream(
  sessionAdapter: ContinuumVercelAiSdkSessionAdapter,
  streamId: string
): boolean {
  const stream = sessionAdapter
    .getStreams?.()
    ?.find((candidate) => candidate.streamId === streamId);
  return stream?.status === 'open';
}

export function createPendingTurnStreams(): PendingTurnStreams {
  return {
    commitStreamIds: new Set<string>(),
    previewStreamIds: new Set<string>(),
  };
}

export function trackTurnStreamApplication(
  application: ContinuumVercelAiSdkPartApplication,
  sessionAdapter: ContinuumVercelAiSdkSessionAdapter,
  pendingTurnStreams: PendingTurnStreams
): void {
  const streamId = readApplicationStreamId(application);
  if (!streamId) {
    return;
  }

  if (!isOpenStream(sessionAdapter, streamId)) {
    pendingTurnStreams.commitStreamIds.delete(streamId);
    pendingTurnStreams.previewStreamIds.delete(streamId);
    return;
  }

  const disposition = getTurnStreamDisposition(application);
  if (disposition === 'commit') {
    pendingTurnStreams.commitStreamIds.add(streamId);
    pendingTurnStreams.previewStreamIds.delete(streamId);
    return;
  }

  if (
    disposition === 'preview' &&
    !pendingTurnStreams.commitStreamIds.has(streamId)
  ) {
    pendingTurnStreams.previewStreamIds.add(streamId);
  }
}

export function finalizeTurnStreams(
  sessionAdapter: ContinuumVercelAiSdkSessionAdapter,
  pendingTurnStreams: PendingTurnStreams,
  outcome: 'ready' | 'error'
): void {
  const commitStreamIds = [...pendingTurnStreams.commitStreamIds];
  const previewStreamIds = [...pendingTurnStreams.previewStreamIds];
  const committedIds = new Set(commitStreamIds);

  pendingTurnStreams.commitStreamIds.clear();
  pendingTurnStreams.previewStreamIds.clear();

  if (outcome === 'error') {
    for (const streamId of new Set([...commitStreamIds, ...previewStreamIds])) {
      if (!isOpenStream(sessionAdapter, streamId)) {
        continue;
      }
      sessionAdapter.abortStream?.(streamId, 'AI stream ended with error');
    }
    return;
  }

  for (const streamId of commitStreamIds) {
    if (!isOpenStream(sessionAdapter, streamId)) {
      continue;
    }

    const result = sessionAdapter.commitStream?.(streamId);
    if (!result || result.status !== 'committed') {
      throw new Error(
        `Continuum stream commit failed with status "${result?.status ?? 'unknown'}"${
          result?.reason ? `: ${result.reason}` : ''
        }.`
      );
    }
  }

  for (const streamId of previewStreamIds) {
    if (committedIds.has(streamId) || !isOpenStream(sessionAdapter, streamId)) {
      continue;
    }

    sessionAdapter.abortStream?.(
      streamId,
      'AI turn completed without a committed Continuum mutation'
    );
  }
}
