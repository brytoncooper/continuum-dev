import type { DetachedRestoreApproval } from '@continuum-dev/protocol';

export type InternalApprovedRestoreTarget = DetachedRestoreApproval;

export interface RejectedRestoreReviewState {
  candidateSignature: string;
  viewVersion: string | null;
  rejectedAt: number;
}
