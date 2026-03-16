import type { DetachedRestoreApproval } from '@continuum-dev/protocol';

export interface InternalApprovedRestoreTarget extends DetachedRestoreApproval {}

export interface RejectedRestoreReviewState {
  candidateSignature: string;
  viewVersion: string | null;
  rejectedAt: number;
}
