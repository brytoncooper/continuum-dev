import type {
  DetachedRestoreReview,
  DetachedRestoreReviewCandidate,
  DetachedRestoreScope,
  NodeValue,
} from '@continuum-dev/core';

export const EMPTY_RESTORE_REVIEWS: DetachedRestoreReview[] = [];
export const EMPTY_RESTORE_CANDIDATES: DetachedRestoreReviewCandidate[] = [];

export function shallowArrayEqual<T>(left: T[], right: T[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }

  return true;
}

export function shallowNodeValueEqual(
  left: NodeValue | undefined,
  right: NodeValue | undefined
): boolean {
  if (left === right) {
    return true;
  }
  if (!left || !right) {
    return false;
  }
  return (
    left.value === right.value &&
    left.isDirty === right.isDirty &&
    left.isSticky === right.isSticky &&
    left.isValid === right.isValid &&
    left.suggestion === right.suggestion
  );
}

export function areRestoreScopesEqual(
  left: DetachedRestoreScope | null,
  right: DetachedRestoreScope | null
): boolean {
  if (left === right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  return (
    left.kind === right.kind &&
    (left.kind === 'live' ||
      ('streamId' in right && left.streamId === right.streamId))
  );
}

export function shallowRestoreCandidatesEqual(
  left: DetachedRestoreReviewCandidate[],
  right: DetachedRestoreReviewCandidate[]
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    const leftCandidate = left[index];
    const rightCandidate = right[index];
    if (
      leftCandidate.candidateId !== rightCandidate.candidateId ||
      leftCandidate.score !== rightCandidate.score ||
      !areRestoreScopesEqual(leftCandidate.scope, rightCandidate.scope)
    ) {
      return false;
    }
  }

  return true;
}

export function shallowRestoreReviewsEqual(
  left: DetachedRestoreReview[],
  right: DetachedRestoreReview[]
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    const leftReview = left[index];
    const rightReview = right[index];
    if (
      leftReview.reviewId !== rightReview.reviewId ||
      leftReview.status !== rightReview.status ||
      !areRestoreScopesEqual(leftReview.scope, rightReview.scope) ||
      !shallowRestoreCandidatesEqual(
        leftReview.candidates,
        rightReview.candidates
      )
    ) {
      return false;
    }
  }

  return true;
}
