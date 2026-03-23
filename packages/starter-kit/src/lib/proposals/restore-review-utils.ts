export function restoreReviewElementId(reviewId: string): string {
  return `continuum-restore-review-${reviewId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}
