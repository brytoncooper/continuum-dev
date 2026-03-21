import type {
  SessionStreamPart,
  SessionStreamResult,
  SessionStreamStartOptions,
} from '../../types.js';
import {
  buildCommittedSnapshotFromCurrentState,
  notifySnapshotAndIssueListeners,
  notifyStreamListeners,
} from '../listeners/index.js';
import { syncFocusedNodeIdToRenderView } from '../focus.js';
import { generateId } from '../state/index.js';
import type { SessionState } from '../state/index.js';
import { commitAppliedViewState } from '../updates/index.js';
import { storeRenderOnlyDetachedValues } from './detached-values.js';
import { getOpenStreamForTargetViewId } from './helpers.js';
import { applyPartToOpenStream } from './part-application.js';
import { getActiveForegroundStream, toPublicSessionStream } from './state.js';
import type { InternalSessionStreamState } from './types.js';

function applyTerminalStreamState(
  internal: SessionState,
  stream: InternalSessionStreamState,
  status: Exclude<SessionStreamResult['status'], 'committed'>,
  reason?: string
): SessionStreamResult {
  stream.status = status;
  stream.updatedAt = internal.clock();

  if (internal.activeForegroundStreamId === stream.streamId) {
    internal.activeForegroundStreamId = null;
  }

  if (status === 'aborted' || status === 'superseded' || status === 'stale') {
    storeRenderOnlyDetachedValues(internal, stream);
  }

  syncFocusedNodeIdToRenderView(internal);
  notifySnapshotAndIssueListeners(internal);
  notifyStreamListeners(internal);

  return {
    streamId: stream.streamId,
    status,
    reason,
  };
}

function replayStreamAgainstCommittedState(
  internal: SessionState,
  stream: InternalSessionStreamState
): InternalSessionStreamState | null {
  if (
    stream.renderOnlyDirtyNodeIds.size > 0 ||
    stream.parts.some((part) => part.kind === 'state')
  ) {
    return null;
  }

  const replayParts = stream.parts.map((part) => structuredClone(part));
  const replayed: InternalSessionStreamState = {
    ...stream,
    workingView: internal.currentView,
    workingData: internal.currentData,
    issues: [...internal.issues],
    diffs: [...internal.diffs],
    resolutions: [...internal.resolutions],
    nodeStatuses: {},
    affectedNodeIds: new Set<string>(),
    parts: [],
    renderOnlyDirtyNodeIds: new Set<string>(),
  };

  try {
    for (const part of replayParts) {
      applyPartToOpenStream(internal, replayed, part);
    }

    for (const canonicalId of stream.renderOnlyDirtyNodeIds) {
      const value = stream.workingData?.values[canonicalId];
      if (!value) {
        continue;
      }

      applyPartToOpenStream(internal, replayed, {
        kind: 'state',
        nodeId: canonicalId,
        value,
        source: stream.source,
      });
      replayed.renderOnlyDirtyNodeIds.add(canonicalId);
    }
  } catch {
    return null;
  }

  return replayed;
}

export function beginStream(
  internal: SessionState,
  options: SessionStreamStartOptions
) {
  if (
    typeof options.targetViewId !== 'string' ||
    options.targetViewId.length === 0
  ) {
    throw new Error('beginStream requires a non-empty targetViewId');
  }

  const requestedMode = options.mode ?? 'foreground';
  const existingForTarget = getOpenStreamForTargetViewId(
    internal,
    options.targetViewId
  );

  if (existingForTarget) {
    if (!options.supersede) {
      throw new Error(
        `An open stream already exists for targetViewId "${options.targetViewId}"`
      );
    }

    applyTerminalStreamState(
      internal,
      existingForTarget,
      'superseded',
      'Superseded by a newer stream'
    );
  }

  if (
    requestedMode === 'foreground' &&
    internal.activeForegroundStreamId &&
    internal.activeForegroundStreamId !== existingForTarget?.streamId
  ) {
    const active = getActiveForegroundStream(internal);
    if (active && !options.supersede) {
      throw new Error('A foreground stream is already active');
    }
    if (active) {
      applyTerminalStreamState(
        internal,
        active,
        'superseded',
        'Superseded by a newer foreground stream'
      );
    }
  }

  const now = internal.clock();
  const streamId = options.streamId ?? generateId('stream', internal.clock);
  const stream: InternalSessionStreamState = {
    streamId,
    source: options.source,
    targetViewId: options.targetViewId,
    baseViewVersion: options.baseViewVersion ?? internal.stableViewVersion,
    mode: requestedMode,
    status: 'open',
    startedAt: now,
    updatedAt: now,
    workingView: internal.currentView,
    workingData: internal.currentData,
    issues: [...internal.issues],
    diffs: [...internal.diffs],
    resolutions: [...internal.resolutions],
    nodeStatuses: {},
    affectedNodeIds: new Set<string>(),
    parts: [],
    renderOnlyDirtyNodeIds: new Set<string>(),
  };

  internal.streams.set(streamId, stream);
  if (requestedMode === 'foreground') {
    internal.activeForegroundStreamId = streamId;
  }

  if (options.initialView) {
    applyPartToOpenStream(internal, stream, {
      kind: 'view',
      view: options.initialView,
    });
  }

  notifyStreamListeners(internal);
  if (requestedMode === 'foreground' || options.initialView) {
    notifySnapshotAndIssueListeners(internal);
  }

  return toPublicSessionStream(stream);
}

export function applyStreamPart(
  internal: SessionState,
  streamId: string,
  part: SessionStreamPart
): void {
  const stream = internal.streams.get(streamId);
  if (!stream || stream.status !== 'open') {
    throw new Error(`Stream ${streamId} is not open`);
  }

  applyPartToOpenStream(internal, stream, part);
  notifyStreamListeners(internal);
  notifySnapshotAndIssueListeners(internal);
}

export function commitStream(
  internal: SessionState,
  streamId: string
): SessionStreamResult {
  const stream = internal.streams.get(streamId);
  if (!stream || stream.status !== 'open') {
    throw new Error(`Stream ${streamId} is not open`);
  }

  let committedStream = stream;
  if (stream.baseViewVersion !== internal.stableViewVersion) {
    const replayed = replayStreamAgainstCommittedState(internal, stream);
    if (!replayed || !replayed.workingView || !replayed.workingData) {
      return applyTerminalStreamState(
        internal,
        stream,
        'stale',
        'Committed base view changed before this stream could be applied'
      );
    }
    committedStream = replayed;
  }

  if (!committedStream.workingView || !committedStream.workingData) {
    return applyTerminalStreamState(
      internal,
      stream,
      'stale',
      'Stream ended without a working view to commit'
    );
  }

  const applied: Parameters<typeof commitAppliedViewState>[1] = {
    priorView: internal.currentView,
    view: committedStream.workingView,
    data: committedStream.workingData,
    issues: committedStream.issues,
    diffs: committedStream.diffs,
    resolutions: committedStream.resolutions,
    strategy: committedStream.parts.some((part) => part.kind === 'append-content')
      ? 'incremental'
      : 'full',
  };

  if (internal.activeForegroundStreamId === streamId) {
    internal.activeForegroundStreamId = null;
  }

  commitAppliedViewState(internal, applied, { notify: false });
  stream.status = 'committed';
  stream.updatedAt = internal.clock();
  stream.workingView = applied.view;
  stream.workingData = applied.data;
  stream.issues = applied.issues;
  stream.diffs = applied.diffs;
  stream.resolutions = applied.resolutions;

  notifySnapshotAndIssueListeners(internal);
  notifyStreamListeners(internal);

  return {
    streamId: stream.streamId,
    status: 'committed',
  };
}

export function abortStream(
  internal: SessionState,
  streamId: string,
  reason?: string
): SessionStreamResult {
  const stream = internal.streams.get(streamId);
  if (!stream || stream.status !== 'open') {
    throw new Error(`Stream ${streamId} is not open`);
  }

  return applyTerminalStreamState(internal, stream, 'aborted', reason);
}

export function getPublicStreams(internal: SessionState) {
  return [...internal.streams.values()].map(toPublicSessionStream);
}

export function getCommittedOrRenderViewId(internal: SessionState): string | null {
  return (
    getActiveForegroundStream(internal)?.workingView?.viewId ??
    buildCommittedSnapshotFromCurrentState(internal)?.view.viewId ??
    null
  );
}
