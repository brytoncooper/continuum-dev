import type { DetachedValue } from '@continuum-dev/contract';

export type DetachedRestoreScope =
  | { kind: 'live' }
  | { kind: 'draft'; streamId: string };

export interface DetachedRestoreReviewCandidate {
  candidateId: string;
  reviewId: string;
  detachedKey: string;
  scope: DetachedRestoreScope;
  targetNodeId: string;
  targetLabel?: string;
  targetParentLabel?: string;
  targetSemanticKey?: string;
  targetKey?: string;
  score: number;
}

export interface DetachedRestoreApproval {
  detachedKey: string;
  detachedValue: DetachedValue;
  scope: DetachedRestoreScope;
  targetNodeId: string;
  targetSemanticKey?: string;
  targetKey?: string;
  targetViewId?: string;
  approvedAt: number;
}

export interface DetachedRestoreReview {
  reviewId: string;
  detachedKey: string;
  scope: DetachedRestoreScope;
  detachedValue: DetachedValue;
  status: 'waiting' | 'candidates' | 'approved';
  candidates: DetachedRestoreReviewCandidate[];
  approvedTarget?: DetachedRestoreApproval;
}
