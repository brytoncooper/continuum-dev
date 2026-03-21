import { describe, expect, it } from 'vitest';
import {
  areRestoreScopesEqual,
  shallowArrayEqual,
  shallowNodeValueEqual,
  shallowRestoreCandidatesEqual,
  shallowRestoreReviewsEqual,
} from './shared.js';

describe('hooks shared helpers', () => {
  it('compares shallow arrays by element identity', () => {
    const shared = [{ id: 'a' }];
    expect(shallowArrayEqual(shared, shared)).toBe(true);
    expect(shallowArrayEqual(shared, [{ id: 'a' }])).toBe(false);
  });

  it('compares node values by shallow fields used for cache reuse', () => {
    expect(
      shallowNodeValueEqual(
        {
          value: 'Ada',
          isDirty: true,
          suggestion: 'Draft Ada',
        },
        {
          value: 'Ada',
          isDirty: true,
          suggestion: 'Draft Ada',
        }
      )
    ).toBe(true);

    expect(
      shallowNodeValueEqual(
        {
          value: 'Ada',
        },
        {
          value: 'Grace',
        }
      )
    ).toBe(false);
  });

  it('matches restore scopes, candidates, and reviews by stable identity fields', () => {
    expect(
      areRestoreScopesEqual(
        { kind: 'draft', streamId: 'stream-1' },
        { kind: 'draft', streamId: 'stream-1' }
      )
    ).toBe(true);

    expect(
      shallowRestoreCandidatesEqual(
        [
          {
            candidateId: 'candidate-1',
            targetNodeId: 'name',
            sourceNodeId: 'old-name',
            score: 0.9,
            scope: { kind: 'live' },
          },
        ],
        [
          {
            candidateId: 'candidate-1',
            targetNodeId: 'name',
            sourceNodeId: 'other',
            score: 0.9,
            scope: { kind: 'live' },
          },
        ]
      )
    ).toBe(true);

    expect(
      shallowRestoreReviewsEqual(
        [
          {
            reviewId: 'review-1',
            status: 'candidates',
            scope: { kind: 'live' },
            candidates: [
              {
                candidateId: 'candidate-1',
                targetNodeId: 'name',
                sourceNodeId: 'old-name',
                score: 0.9,
                scope: { kind: 'live' },
              },
            ],
          },
        ],
        [
          {
            reviewId: 'review-1',
            status: 'candidates',
            scope: { kind: 'live' },
            candidates: [
              {
                candidateId: 'candidate-1',
                targetNodeId: 'name',
                sourceNodeId: 'old-name',
                score: 0.9,
                scope: { kind: 'live' },
              },
            ],
          },
        ]
      )
    ).toBe(true);
  });
});
