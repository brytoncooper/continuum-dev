import type { NodeValue } from '@continuum-dev/contract';
import { applyContinuumNodeValueWrite } from '@continuum-dev/runtime';
import {
  notifySnapshotAndIssueListeners,
  notifyStreamListeners,
} from '../listeners/index.js';
import type { SessionState } from '../state/index.js';
import { getActiveForegroundStream } from './state.js';
import {
  resolveCommittedNode,
  resolveStreamNode,
  resolveStreamNodeForCommittedUpdate,
} from './helpers.js';
import type { InternalSessionStreamState } from './types.js';

export function syncIssuesForStreamStateUpdate(
  internal: SessionState,
  stream: InternalSessionStreamState,
  canonicalId: string,
  issues: SessionState['issues']
): void {
  if (!internal.validateOnUpdate || issues.length === 0) {
    return;
  }

  stream.issues = [
    ...stream.issues.filter((issue) => issue.nodeId !== canonicalId),
    ...issues,
  ];
}

export function syncCommittedValueToStreams(
  internal: SessionState,
  canonicalId: string,
  value: NodeValue
): void {
  const now = internal.clock();

  for (const stream of internal.streams.values()) {
    if (stream.status !== 'open' || !stream.workingView) {
      continue;
    }

    const lookup = resolveStreamNodeForCommittedUpdate(
      internal,
      stream,
      canonicalId
    );
    if (!lookup) {
      continue;
    }

    const result = applyContinuumNodeValueWrite({
      view: stream.workingView,
      data: stream.workingData,
      nodeId: lookup.canonicalId,
      value,
      sessionId: internal.sessionId,
      timestamp: now,
      validate: internal.validateOnUpdate,
    });
    if (result.kind !== 'applied') {
      continue;
    }

    stream.workingData = result.data;
    syncIssuesForStreamStateUpdate(internal, stream, lookup.canonicalId, result.issues);
    stream.updatedAt = now;
  }
}

export function applyRenderOnlyValueUpdateIfPossible(
  internal: SessionState,
  nodeId: string,
  value: NodeValue
): boolean {
  const activeStream = getActiveForegroundStream(internal);
  if (!activeStream || !activeStream.workingView) {
    return false;
  }

  const committedLookup = resolveCommittedNode(internal, nodeId);
  if (committedLookup) {
    return false;
  }

  const workingLookup = resolveStreamNode(activeStream, nodeId);
  if (!workingLookup) {
    return false;
  }

  const now = internal.clock();
  const result = applyContinuumNodeValueWrite({
    view: activeStream.workingView,
    data: activeStream.workingData,
    nodeId: workingLookup.canonicalId,
    value,
    sessionId: internal.sessionId,
    timestamp: now,
    validate: internal.validateOnUpdate,
  });
  if (result.kind !== 'applied') {
    return false;
  }

  activeStream.workingData = result.data;
  activeStream.renderOnlyDirtyNodeIds.add(workingLookup.canonicalId);
  syncIssuesForStreamStateUpdate(
    internal,
    activeStream,
    workingLookup.canonicalId,
    result.issues
  );
  activeStream.updatedAt = now;
  notifySnapshotAndIssueListeners(internal);
  notifyStreamListeners(internal);
  return true;
}
