import type { DetachedValue } from '@continuum-dev/contract';
import type { SessionState } from '../state/index.js';
import { findNodeByIdentity } from '@continuum-dev/runtime/restore-candidates';
import type { InternalApprovedRestoreTarget, RejectedRestoreReviewState } from './types.js';
import type { DetachedRestoreReviewCandidate } from '../../types.js';
import type { ScopeSnapshot } from './scopes.js';
import { scopeKey, getScopeSnapshot } from './scopes.js';
import { applyDetachedValueToScope } from './apply.js';
import { candidateSignature } from './candidates.js';
import type { InternalSessionStreamState } from '../streams/types.js';
import type { DetachedRestoreScope } from '../../types.js';

export function buildApprovedRestoreTarget(args: {
  detachedKey: string;
  detachedValue: DetachedValue;
  scope: DetachedRestoreScope;
  scopeView: ScopeSnapshot['view'];
  candidate: DetachedRestoreReviewCandidate;
  approvedAt: number;
}): InternalApprovedRestoreTarget {
  return {
    detachedKey: args.detachedKey,
    detachedValue: structuredClone(args.detachedValue),
    scope: structuredClone(args.scope),
    targetNodeId: args.candidate.targetNodeId,
    targetSemanticKey: args.candidate.targetSemanticKey,
    targetKey: args.candidate.targetKey,
    targetViewId: args.scopeView.viewId,
    approvedAt: args.approvedAt,
  };
}

export function shouldDismissReview(
  reviewId: string,
  viewVersion: string | null,
  candidates: DetachedRestoreReviewCandidate[],
  rejected: Record<string, RejectedRestoreReviewState>
): boolean {
  const existing = rejected[reviewId];
  if (!existing || candidates.length === 0) {
    return false;
  }
  return (
    existing.viewVersion === viewVersion &&
    existing.candidateSignature === candidateSignature(candidates)
  );
}

export function replayApprovedRestoreTargetToScope(
  internal: SessionState,
  scopeSnapshot: ScopeSnapshot,
  detachedKey: string,
  approval: InternalApprovedRestoreTarget
): boolean {
  if (scopeKey(approval.scope) !== scopeKey(scopeSnapshot.scope)) {
    return false;
  }
  if (approval.targetViewId && approval.targetViewId !== scopeSnapshot.view.viewId) {
    return false;
  }

  const hasDetachedKey = scopeSnapshot.data?.detachedValues && detachedKey in scopeSnapshot.data.detachedValues;
  const detachedValue =
    (scopeSnapshot.data?.detachedValues?.[detachedKey]) ?? approval.detachedValue;
  if (!hasDetachedKey) {
    return false;
  }

  const target = findNodeByIdentity(scopeSnapshot.view, approval);
  if (!target) {
    return false;
  }

  return applyDetachedValueToScope({
    internal,
    scopeSnapshot,
    detachedKey,
    detachedValue,
    targetNodeId: target.canonicalId,
    requireUnprotected: true,
  });
}

export function replayApprovedRestoreTargetsToCommittedState(
  internal: SessionState
): boolean {
  const scopeSnapshot = getScopeSnapshot(internal, { kind: 'live' });
  if (!scopeSnapshot) {
    return false;
  }

  let changed = false;
  for (const approval of Object.values(internal.approvedRestoreTargets)) {
    if (
      replayApprovedRestoreTargetToScope(
        internal,
        scopeSnapshot,
        approval.detachedKey,
        approval
      )
    ) {
      changed = true;
      scopeSnapshot.data = internal.currentData!;
    }
  }

  return changed;
}

export function replayApprovedRestoreTargetsToStream(
  internal: SessionState,
  stream: InternalSessionStreamState
): boolean {
  if (
    stream.status !== 'open' ||
    !stream.workingView ||
    !stream.workingData
  ) {
    return false;
  }

  const scopeSnapshot: ScopeSnapshot = {
    scope: { kind: 'draft', streamId: stream.streamId },
    view: stream.workingView,
    data: stream.workingData,
    stream,
  };

  let changed = false;
  for (const approval of Object.values(internal.approvedRestoreTargets)) {
    if (
      replayApprovedRestoreTargetToScope(
        internal,
        scopeSnapshot,
        approval.detachedKey,
        approval
      )
    ) {
      changed = true;
      scopeSnapshot.data = stream.workingData;
    }
  }

  return changed;
}
