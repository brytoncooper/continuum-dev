import { findRestoreCandidates } from '@continuum-dev/runtime/restore-candidates';
import type { DetachedValue } from '@continuum-dev/contract';
import type { DetachedRestoreReviewCandidate, DetachedRestoreScope } from '../../types.js';
import { scopeKey, type ScopeSnapshot } from './scopes.js';

export function reviewIdFor(detachedKey: string, scope: DetachedRestoreScope): string {
  return `${scopeKey(scope)}:${detachedKey}`;
}

export function candidateSignature(
  candidates: DetachedRestoreReviewCandidate[]
): string {
  return candidates
    .map((candidate) => `${candidate.targetNodeId}:${candidate.score}`)
    .join('|');
}

export function buildCandidateList(
  scope: DetachedRestoreScope,
  detachedKey: string,
  detachedValue: DetachedValue,
  scopeSnapshot: ScopeSnapshot
): DetachedRestoreReviewCandidate[] {
  const reviewId = reviewIdFor(detachedKey, scope);
  if (!scopeSnapshot.data) return [];
  
  const matches = findRestoreCandidates(
    scopeSnapshot.view.nodes,
    scopeSnapshot.data,
    detachedValue
  );

  return matches.map((candidate) => ({
    candidateId: `${reviewId}:${candidate.targetNodeId}`,
    reviewId,
    detachedKey,
    scope,
    ...candidate,
  }));
}
