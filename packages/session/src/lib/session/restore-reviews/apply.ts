import type { DetachedValue } from '@continuum-dev/contract';
import { applyContinuumNodeValueWrite } from '@continuum-dev/runtime';
import type { SessionState } from '../state/index.js';
import { syncIssuesForStreamStateUpdate } from '../streams/sync.js';
import { isProtectedValue } from '../streams/helpers.js';
import type { ScopeSnapshot } from './scopes.js';
import {
  toAcceptedNodeValue,
  removeDetachedValue,
  replaceIssuesForNode,
  refreshLastAutoCheckpoint,
} from './state-utils.js';

export interface ApplyArgs {
  internal: SessionState;
  scopeSnapshot: ScopeSnapshot;
  detachedKey: string;
  detachedValue: DetachedValue;
  targetNodeId: string;
  requireUnprotected: boolean;
}

export function applyDetachedValueToScope(args: ApplyArgs): boolean {
  if (!args.scopeSnapshot.data) return false;
  const targetValue = args.scopeSnapshot.data.values[args.targetNodeId];

  if (args.requireUnprotected && isProtectedValue(targetValue)) {
    return false;
  }

  const applied = applyContinuumNodeValueWrite({
    view: args.scopeSnapshot.view,
    data: args.scopeSnapshot.data,
    nodeId: args.targetNodeId,
    value: toAcceptedNodeValue(args.detachedValue.value),
    sessionId: args.internal.sessionId,
    timestamp: args.internal.clock(),
    validate: args.internal.validateOnUpdate,
  });

  if (applied.kind !== 'applied') {
    return false;
  }

  const nextData = removeDetachedValue(applied.data, args.detachedKey);

  if (args.scopeSnapshot.scope.kind === 'live') {
    args.internal.currentData = nextData;
    args.internal.issues = replaceIssuesForNode(
      args.internal.issues,
      applied.canonicalId,
      applied.issues
    );
    refreshLastAutoCheckpoint(args.internal);
  } else if (args.scopeSnapshot.stream) {
    args.scopeSnapshot.stream.workingData = nextData;
    syncIssuesForStreamStateUpdate(
      args.internal,
      args.scopeSnapshot.stream,
      applied.canonicalId,
      applied.issues
    );
    args.scopeSnapshot.stream.updatedAt = args.internal.clock();
  }

  return true;
}
