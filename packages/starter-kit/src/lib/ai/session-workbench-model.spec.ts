import { describe, expect, it } from 'vitest';
import type { DetachedRestoreReview } from '@continuum-dev/core';
import { buildRestoreReviewSections } from './session-workbench-model.js';

describe('buildRestoreReviewSections', () => {
  it('hides waiting restore reviews that do not have actionable matches', () => {
    const reviews: DetachedRestoreReview[] = [
      {
        reviewId: 'draft:missing-email',
        detachedKey: 'missing-email',
        scope: {
          kind: 'draft',
          streamId: 'stream-1',
        },
        detachedValue: {
          value: 'person@example.com',
          previousNodeType: 'field',
          previousLabel: 'Email',
          detachedAt: 1,
          reason: 'removed',
        },
        status: 'waiting',
        candidates: [],
      },
      {
        reviewId: 'live:secondary-email',
        detachedKey: 'secondary-email',
        scope: {
          kind: 'live',
        },
        detachedValue: {
          value: 'person@example.com',
          previousNodeType: 'field',
          previousLabel: 'Secondary email',
          detachedAt: 1,
          reason: 'removed',
        },
        status: 'candidates',
        candidates: [
          {
            candidateId: 'candidate-1',
            reviewId: 'live:secondary-email',
            detachedKey: 'secondary-email',
            scope: {
              kind: 'live',
            },
            targetNodeId: 'profile/secondary_email',
            targetLabel: 'Secondary email',
            targetParentLabel: 'Profile',
            score: 48,
          },
        ],
      },
    ];

    expect(buildRestoreReviewSections(reviews)).toEqual([
      {
        id: 'live',
        title: 'In live form',
        items: [
          {
            reviewId: 'live:secondary-email',
            detachedKey: 'secondary-email',
            title: 'Secondary email',
            valuePreview: 'person@example.com',
            status: 'candidates',
            scope: {
              kind: 'live',
            },
            approvedTargetLabel: undefined,
            candidates: [
              {
                candidateId: 'candidate-1',
                targetNodeId: 'profile/secondary_email',
                title: 'Secondary email',
                subtitle: 'Profile',
              },
            ],
          },
        ],
      },
    ]);
  });
});
