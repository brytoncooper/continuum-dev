import type { SessionState } from '../state/index.js';
import type {
  DetachedRestoreScope,
  DetachedRestoreReview,
} from '../../types.js';
import {
  scopeKey,
  getScopeSnapshot,
  collectScopeSnapshots,
  scopeViewVersion,
} from './scopes.js';
import {
  reviewIdFor,
  buildCandidateList,
  candidateSignature,
} from './candidates.js';
import { buildApprovedRestoreTarget, shouldDismissReview } from './replay.js';
import { applyDetachedValueToScope } from './apply.js';
import {
  notifySnapshotAndIssueListeners,
  notifyStreamListeners,
} from '../listeners/index.js';
import { syncCommittedValueToStreams } from '../streams/sync.js';

export function getPendingRestoreReviews(
  internal: SessionState
): DetachedRestoreReview[] {
  if (!internal.restoreReviewsEnabled) {
    return [];
  }

  const reviews: DetachedRestoreReview[] = [];

  for (const scopeSnapshot of collectScopeSnapshots(internal)) {
    if (!scopeSnapshot.data) continue;
    const detachedValues = scopeSnapshot.data.detachedValues ?? {};

    for (const [detachedKey, detachedValue] of Object.entries(detachedValues)) {
      const reviewId = reviewIdFor(detachedKey, scopeSnapshot.scope);
      const approval = internal.approvedRestoreTargets[reviewId];

      if (approval) {
        reviews.push({
          reviewId,
          detachedKey,
          scope: structuredClone(scopeSnapshot.scope),
          detachedValue: structuredClone(detachedValue),
          status: 'approved',
          candidates: [],
          approvedTarget: structuredClone(approval),
        });
        continue;
      }

      const candidates = buildCandidateList(
        scopeSnapshot.scope,
        detachedKey,
        detachedValue,
        scopeSnapshot
      );

      if (
        shouldDismissReview(
          reviewId,
          scopeViewVersion(scopeSnapshot),
          candidates,
          internal.rejectedRestoreReviews
        )
      ) {
        continue;
      }

      reviews.push({
        reviewId,
        detachedKey,
        scope: structuredClone(scopeSnapshot.scope),
        detachedValue: structuredClone(detachedValue),
        status: candidates.length > 0 ? 'candidates' : 'waiting',
        candidates,
      });
    }
  }

  return reviews.sort((left, right) =>
    left.reviewId.localeCompare(right.reviewId)
  );
}

export function acceptRestoreCandidate(
  internal: SessionState,
  detachedKey: string,
  targetNodeId: string,
  scope: DetachedRestoreScope
): void {
  const scopeSnapshot = getScopeSnapshot(internal, scope);
  if (!scopeSnapshot || !scopeSnapshot.data) return;

  const detachedValue = scopeSnapshot.data.detachedValues?.[detachedKey];
  if (!detachedValue) return;

  const candidates = buildCandidateList(
    scope,
    detachedKey,
    detachedValue,
    scopeSnapshot
  );
  const candidate = candidates.find(
    (entry) => entry.targetNodeId === targetNodeId
  );
  if (!candidate) return;

  const approval = buildApprovedRestoreTarget({
    detachedKey,
    detachedValue,
    scope,
    scopeView: scopeSnapshot.view,
    candidate,
    approvedAt: internal.clock(),
  });

  const reviewId = reviewIdFor(detachedKey, scope);
  internal.approvedRestoreTargets[reviewId] = approval;
  delete internal.rejectedRestoreReviews[reviewId];

  const applied = applyDetachedValueToScope({
    internal,
    scopeSnapshot,
    detachedKey,
    detachedValue,
    targetNodeId: candidate.targetNodeId,
    requireUnprotected: false,
  });

  if (scope.kind === 'live') {
    const appliedValue = internal.currentData?.values[candidate.targetNodeId];
    if (applied && appliedValue) {
      syncCommittedValueToStreams(
        internal,
        candidate.targetNodeId,
        appliedValue
      );
    }
    delete internal.approvedRestoreTargets[reviewId];
    notifySnapshotAndIssueListeners(internal);
    notifyStreamListeners(internal);
    return;
  }

  if (scopeSnapshot.stream && applied) {
    notifySnapshotAndIssueListeners(internal);
    notifyStreamListeners(internal);
  }
}

export function rejectRestoreReview(
  internal: SessionState,
  detachedKey: string,
  scope: DetachedRestoreScope
): void {
  const scopeSnapshot = getScopeSnapshot(internal, scope);
  if (!scopeSnapshot || !scopeSnapshot.data) return;

  const detachedValue = scopeSnapshot.data.detachedValues?.[detachedKey];
  if (!detachedValue) return;

  const reviewId = reviewIdFor(detachedKey, scope);
  const candidates = buildCandidateList(
    scope,
    detachedKey,
    detachedValue,
    scopeSnapshot
  );

  internal.rejectedRestoreReviews[reviewId] = {
    candidateSignature: candidateSignature(candidates),
    viewVersion: scopeViewVersion(scopeSnapshot),
    rejectedAt: internal.clock(),
  };

  delete internal.approvedRestoreTargets[reviewId];
  notifySnapshotAndIssueListeners(internal);
  notifyStreamListeners(internal);
}

export function clearApprovedRestoreTargetsForScope(
  internal: SessionState,
  scope: DetachedRestoreScope
): void {
  const targetScopeKey = scopeKey(scope);
  for (const [key, approval] of Object.entries(
    internal.approvedRestoreTargets
  )) {
    if (scopeKey(approval.scope) === targetScopeKey) {
      delete internal.approvedRestoreTargets[key];
    }
  }
}
