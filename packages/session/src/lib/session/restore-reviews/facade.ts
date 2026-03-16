import type { Session } from '../../types.js';
import type { NodeValue } from '@continuum-dev/contract';
import type { SessionState } from '../state/index.js';
import { getPendingRestoreReviews, acceptRestoreCandidate, rejectRestoreReview, clearApprovedRestoreTargetsForScope } from './index.js';

function assertNotDestroyed(internal: SessionState): void {
  if (internal.destroyed) {
    throw new Error('Session has been destroyed');
  }
}

export function createRestoreReviewsFacade(internal: SessionState, sessionRef: Session): Pick<Session, 'getPendingRestoreReviews' | 'acceptRestoreCandidate' | 'rejectRestoreReview' | 'clearApprovedRestoreTargetsForScope' | 'updateStateInScope'> {
  return {
    getPendingRestoreReviews() {
      assertNotDestroyed(internal);
      return getPendingRestoreReviews(internal);
    },
    acceptRestoreCandidate(detachedKey: string, targetNodeId: string, scope: Parameters<Session['acceptRestoreCandidate']>[2]) {
      assertNotDestroyed(internal);
      acceptRestoreCandidate(internal, detachedKey, targetNodeId, scope);
    },
    rejectRestoreReview(detachedKey: string, scope: Parameters<Session['rejectRestoreReview']>[1]) {
      assertNotDestroyed(internal);
      rejectRestoreReview(internal, detachedKey, scope);
    },
    clearApprovedRestoreTargetsForScope(scope: Parameters<Session['clearApprovedRestoreTargetsForScope']>[0]) {
      assertNotDestroyed(internal);
      clearApprovedRestoreTargetsForScope(internal, scope);
    },
    updateStateInScope(nodeId: string, value: NodeValue, scope: Parameters<Session['updateStateInScope']>[2]) {
      assertNotDestroyed(internal);
      if (scope.kind === 'live') {
        sessionRef.updateState(nodeId, value);
      } else {
        sessionRef.applyStreamPart(scope.streamId, {
          kind: 'state',
          nodeId,
          value,
        });
      }
    }
  };
}
