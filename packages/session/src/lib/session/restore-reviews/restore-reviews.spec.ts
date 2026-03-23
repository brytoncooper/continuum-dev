import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SessionState } from '../state/index.js';
import type { DetachedValue } from '@continuum-dev/contract';
import {
  acceptRestoreCandidate,
  clearApprovedRestoreTargetsForScope,
  getPendingRestoreReviews,
  rejectRestoreReview,
} from './index.js';

describe('restore-reviews orchestrator', () => {
  let mockInternal: SessionState;

  beforeEach(() => {
    mockInternal = {
      sessionId: 'test-session',
      clock: () => Date.now(),
      destroyed: false,
      validateOnUpdate: true,
      options: {},
      factory: {} as any,
      persistence: undefined,
      intents: [],
      checkpoints: [],
      issues: [],
      diffs: [],
      resolutions: [],
      currentView: {
        version: 1,
        viewId: 'v1',
        nodes: [],
        timestamp: Date.now(),
        sessionId: 'test-session',
      },
      currentData: {
        values: {},
        detachedValues: {},
        lineage: { timestamp: Date.now(), sessionId: 'test-session' },
      },
      streams: new Map(),
      listeners: new Set(),
      intentListeners: new Set(),
      issueListeners: new Set(),
      streamListeners: new Set(),
      approvedRestoreTargets: {},
      rejectedRestoreReviews: {},
    } as unknown as SessionState;
  });

  it('handles empty states correctly', () => {
    const reviews = getPendingRestoreReviews(mockInternal);
    expect(reviews.length).toBe(0);
  });
});
