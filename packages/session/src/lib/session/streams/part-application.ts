import type { SessionStreamPart } from '../../types.js';
import {
  applyContinuumNodeValueUpdate,
  applyContinuumViewStreamPart,
  classifyContinuumValueIngress,
  collectCanonicalNodeIds,
} from '@continuum-dev/runtime';
import type { SessionState } from '../state/index.js';
import { reconcileViewUpdate } from '../updates/index.js';
import {
  appendUnknownNodeStreamIssue,
  resolveStreamNode,
} from './helpers.js';
import {
  syncCommittedValueToStreams,
  syncIssuesForStreamStateUpdate,
} from './sync.js';
import type { InternalSessionStreamState } from './types.js';

function replaceIssuesForNode(
  issues: SessionState['issues'],
  nodeId: string,
  nextIssues: SessionState['issues']
): SessionState['issues'] {
  return [
    ...issues.filter((issue) => issue.nodeId !== nodeId),
    ...nextIssues,
  ];
}

function applyStatePartToStream(
  internal: SessionState,
  stream: InternalSessionStreamState,
  part: Extract<SessionStreamPart, { kind: 'state' }>
): void {
  const now = internal.clock();
  const decision = classifyContinuumValueIngress({
    view: internal.currentView,
    data: internal.currentData,
    nodeId: part.nodeId,
  });

  if (decision.kind === 'proposal') {
    internal.pendingProposals[decision.canonicalId] = {
      nodeId: decision.canonicalId,
      proposedValue: part.value,
      currentValue: decision.currentValue ?? { value: undefined },
      proposedAt: now,
      source: part.source ?? stream.source,
    };
    stream.updatedAt = now;
    return;
  }

  if (decision.kind === 'apply') {
    const applied = applyContinuumNodeValueUpdate({
      view: internal.currentView,
      data: internal.currentData,
      nodeId: decision.canonicalId,
      value: part.value,
      sessionId: internal.sessionId,
      timestamp: now,
      validate: internal.validateOnUpdate,
    });
    if (applied.kind === 'applied') {
      internal.currentData = applied.data;
      internal.issues = replaceIssuesForNode(
        internal.issues,
        applied.canonicalId,
        applied.issues
      );
      syncCommittedValueToStreams(internal, applied.canonicalId, part.value);
      delete internal.pendingProposals[applied.canonicalId];
    }
    stream.updatedAt = now;
    return;
  }

  const workingLookup = resolveStreamNode(stream, part.nodeId);
  if (!workingLookup) {
    appendUnknownNodeStreamIssue(
      stream,
      part.nodeId,
      `Node ${part.nodeId} not found in active stream view`
    );
    stream.updatedAt = now;
    return;
  }

  const applied = applyContinuumNodeValueUpdate({
    view: stream.workingView,
    data: stream.workingData,
    nodeId: workingLookup.canonicalId,
    value: part.value,
    sessionId: internal.sessionId,
    timestamp: now,
    validate: internal.validateOnUpdate,
  });
  if (applied.kind !== 'applied') {
    appendUnknownNodeStreamIssue(
      stream,
      part.nodeId,
      `Node ${part.nodeId} not found in active stream view`
    );
    stream.updatedAt = now;
    return;
  }

  stream.workingData = applied.data;
  syncIssuesForStreamStateUpdate(
    internal,
    stream,
    applied.canonicalId,
    applied.issues
  );
  stream.updatedAt = now;
}

function applyViewResultToStream(
  stream: InternalSessionStreamState,
  applied: ReturnType<typeof reconcileViewUpdate>,
  affectedNodeIds: Iterable<string>
): void {
  stream.workingView = applied.view;
  stream.workingData = applied.data;
  stream.issues = applied.issues;
  stream.diffs = applied.diffs;
  stream.resolutions = applied.resolutions;
  for (const nodeId of affectedNodeIds) {
    stream.affectedNodeIds.add(nodeId);
  }
}

export function applyPartToOpenStream(
  internal: SessionState,
  stream: InternalSessionStreamState,
  part: SessionStreamPart
): void {
  switch (part.kind) {
    case 'view': {
      if (part.view.viewId !== stream.targetViewId) {
        throw new Error(
          `Stream ${stream.streamId} targets ${stream.targetViewId}, but received view ${part.view.viewId}`
        );
      }

      const applied = reconcileViewUpdate(
        stream.workingView,
        stream.workingData,
        part.view,
        {
          clock: internal.clock,
          reconciliationOptions: internal.reconciliationOptions,
          sessionId: internal.sessionId,
          issues: stream.issues,
          diffs: stream.diffs,
          resolutions: stream.resolutions,
        }
      );
      applyViewResultToStream(
        stream,
        applied,
        collectCanonicalNodeIds(applied.view.nodes)
      );
      break;
    }
    case 'patch':
    case 'insert-node':
    case 'move-node':
    case 'wrap-nodes':
    case 'replace-node':
    case 'remove-node':
    case 'append-content': {
      const workingView = stream.workingView ?? internal.currentView;
      if (!workingView) {
        throw new Error(
          `Cannot apply a stream ${part.kind} before a working view exists for ${stream.streamId}`
        );
      }

      if (
        part.kind === 'patch' &&
        part.patch.viewId &&
        part.patch.viewId.length > 0 &&
        part.patch.viewId !== stream.targetViewId
      ) {
        throw new Error(
          `Stream ${stream.streamId} targets ${stream.targetViewId}, but received patch for ${part.patch.viewId}`
        );
      }

      const next = applyContinuumViewStreamPart({
        currentView: workingView,
        part,
      });
      const applied = reconcileViewUpdate(
        stream.workingView,
        stream.workingData,
        next.view,
        {
          clock: internal.clock,
          reconciliationOptions: internal.reconciliationOptions,
          sessionId: internal.sessionId,
          issues: stream.issues,
          diffs: stream.diffs,
          resolutions: stream.resolutions,
        },
        {
          affectedNodeIds: next.affectedNodeIds,
          incrementalHint: next.incrementalHint,
        }
      );
      applyViewResultToStream(stream, applied, next.affectedNodeIds);
      break;
    }
    case 'state':
      applyStatePartToStream(internal, stream, part);
      stream.affectedNodeIds.add(part.nodeId);
      break;
    case 'status':
      stream.latestStatus = {
        status: part.status,
        level: part.level ?? 'info',
      };
      break;
    case 'node-status':
      stream.nodeStatuses[part.nodeId] = {
        status: part.status,
        level: part.level ?? 'info',
        ...(part.subtree ? { subtree: true } : {}),
      };
      break;
  }

  stream.parts.push(structuredClone(part));
  stream.updatedAt = internal.clock();
}
