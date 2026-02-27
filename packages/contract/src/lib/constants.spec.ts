import { describe, expect, it } from 'vitest';
import { ACTION_STATUS, DIFF_TYPES, INTERACTION_TYPES, ISSUE_CODES, ISSUE_SEVERITY, TRACE_ACTIONS } from './constants.js';
import type { PendingAction } from './interaction.js';

describe('contract constants', () => {
  it('defines stable issue, trace, and diff constants', () => {
    expect(Object.values(ISSUE_CODES)).toEqual([
      'NO_PRIOR_STATE',
      'NO_PRIOR_SCHEMA',
      'TYPE_MISMATCH',
      'COMPONENT_REMOVED',
      'MIGRATION_FAILED',
      'UNTRUSTED_CARRY',
      'VALIDATION_FAILED',
      'UNKNOWN_COMPONENT',
    ]);
    expect(Object.values(TRACE_ACTIONS)).toEqual(['carried', 'migrated', 'dropped', 'added', 'restored']);
    expect(Object.values(DIFF_TYPES)).toEqual(['added', 'removed', 'migrated', 'type-changed', 'restored']);
    expect(Object.values(ISSUE_SEVERITY)).toEqual(['error', 'warning', 'info']);
    expect(Object.values(INTERACTION_TYPES)).toEqual(['state-update', 'value-change']);
  });

  it('keeps PendingAction.status aligned with ACTION_STATUS values', () => {
    const action: PendingAction = {
      id: 'a',
      componentId: 'c',
      actionType: 'submit',
      payload: {},
      createdAt: 0,
      schemaVersion: '1',
      status: ACTION_STATUS.PENDING,
    };
    expect(Object.values(ACTION_STATUS)).toContain(action.status);
  });
});
