import { describe, expect, it } from 'vitest';
import { DATA_RESOLUTIONS, INTERACTION_TYPES, INTENT_STATUS, ISSUE_CODES, ISSUE_SEVERITY, VIEW_DIFFS } from './constants.js';
import type { PendingIntent } from './interactions.js';

describe('contract constants', () => {
  it('defines stable issue, trace, and diff constants', () => {
    expect(Object.values(ISSUE_CODES)).toEqual([
      'NO_PRIOR_DATA',
      'NO_PRIOR_VIEW',
      'TYPE_MISMATCH',
      'NODE_REMOVED',
      'MIGRATION_FAILED',
      'UNVALIDATED_CARRY',
      'VALIDATION_FAILED',
      'UNKNOWN_NODE',
      'DUPLICATE_NODE_ID',
      'DUPLICATE_NODE_KEY',
      'COLLECTION_CONSTRAINT_VIOLATED',
      'SCOPE_COLLISION',
    ]);
    expect(Object.values(DATA_RESOLUTIONS)).toEqual(['carried', 'migrated', 'detached', 'added', 'restored']);
    expect(Object.values(VIEW_DIFFS)).toEqual(['added', 'removed', 'migrated', 'type-changed', 'restored']);
    expect(Object.values(ISSUE_SEVERITY)).toEqual(['error', 'warning', 'info']);
    expect(Object.values(INTERACTION_TYPES)).toEqual(['data-update', 'value-change', 'view-context-change']);
  });

  it('keeps PendingIntent.status aligned with INTENT_STATUS values', () => {
    const action: PendingIntent = {
      intentId: 'a',
      nodeId: 'c',
      intentName: 'submit',
      payload: {},
      queuedAt: 0,
      viewVersion: '1',
      status: INTENT_STATUS.PENDING,
    };
    expect(Object.values(INTENT_STATUS)).toContain(action.status);
  });
});
