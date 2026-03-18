import { useCallback, useContext, useRef, useSyncExternalStore } from 'react';
import type {
  DetachedRestoreReview,
  DetachedRestoreReviewCandidate,
} from '@continuum-dev/core';
import {
  ContinuumRenderScopeContext,
} from '../context/render-contexts.js';
import { ContinuumContext } from '../context/render-contexts.js';
import {
  EMPTY_RESTORE_CANDIDATES,
  EMPTY_RESTORE_REVIEWS,
  areRestoreScopesEqual,
  shallowRestoreCandidatesEqual,
  shallowRestoreReviewsEqual,
} from './shared.js';

/**
 * Returns pending restore reviews for detached values in live and draft scopes.
 */
export function useContinuumRestoreReviews(): DetachedRestoreReview[] {
  const ctx = useContext(ContinuumContext);
  const session = ctx?.session;
  const store = ctx?.store;
  const reviewsCacheRef = useRef<DetachedRestoreReview[]>([]);

  const subscribe = useCallback(
    (onStoreChange: () => void) =>
      store ? store.subscribeSnapshot(onStoreChange) : () => undefined,
    [store]
  );

  const getSnapshot = useCallback(() => {
    if (!session) {
      if (reviewsCacheRef.current !== EMPTY_RESTORE_REVIEWS) {
        reviewsCacheRef.current = EMPTY_RESTORE_REVIEWS;
      }
      return reviewsCacheRef.current;
    }

    const nextReviews = session.getPendingRestoreReviews();
    if (shallowRestoreReviewsEqual(reviewsCacheRef.current, nextReviews)) {
      return reviewsCacheRef.current;
    }

    reviewsCacheRef.current = nextReviews;
    return nextReviews;
  }, [session]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Returns restore candidates for the current node in the active render scope.
 */
export function useContinuumRestoreCandidates(
  nodeId: string
): DetachedRestoreReviewCandidate[] {
  const ctx = useContext(ContinuumContext);
  const renderScope = useContext(ContinuumRenderScopeContext);
  const session = ctx?.session;
  const store = ctx?.store;
  const candidatesCacheRef = useRef<DetachedRestoreReviewCandidate[]>([]);

  const subscribe = useCallback(
    (onStoreChange: () => void) =>
      store ? store.subscribeSnapshot(onStoreChange) : () => undefined,
    [store]
  );

  const getSnapshot = useCallback(() => {
    if (!session || !renderScope) {
      if (candidatesCacheRef.current !== EMPTY_RESTORE_CANDIDATES) {
        candidatesCacheRef.current = EMPTY_RESTORE_CANDIDATES;
      }
      return candidatesCacheRef.current;
    }

    const nextCandidates = session
      .getPendingRestoreReviews()
      .filter(
        (review) =>
          review.status === 'candidates' &&
          areRestoreScopesEqual(review.scope, renderScope)
      )
      .flatMap((review) =>
        review.candidates.filter((candidate) => candidate.targetNodeId === nodeId)
      );

    if (
      shallowRestoreCandidatesEqual(candidatesCacheRef.current, nextCandidates)
    ) {
      return candidatesCacheRef.current;
    }

    candidatesCacheRef.current = nextCandidates;
    return nextCandidates;
  }, [nodeId, renderScope, session]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
