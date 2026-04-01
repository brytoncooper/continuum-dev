import { describe, expect, it } from 'vitest';
import type { ViewDefinition, ViewNode } from '@continuum-dev/contract';
import { createSession } from '../session.js';

const aiFlexibleProtection = {
  owner: 'ai',
  stage: 'flexible',
} as const;

const aiReviewedProtection = {
  owner: 'ai',
  stage: 'reviewed',
} as const;

const aiLockedProtection = {
  owner: 'ai',
  stage: 'locked',
} as const;

const aiSubmittedProtection = {
  owner: 'ai',
  stage: 'submitted',
} as const;

const userFlexibleProtection = {
  owner: 'user',
  stage: 'flexible',
} as const;

function makeView(nodes: ViewNode[]): ViewDefinition {
  return { viewId: 'test-view', version: '1.0', nodes };
}

describe('protection actions', () => {
  it('reviewValues promotes only AI flexible values and preserves dirty ones', () => {
    const session = createSession();
    session.pushView(
      makeView([
        { id: 'a', type: 'field', dataType: 'string' },
        { id: 'b', type: 'field', dataType: 'string' },
      ])
    );

    session.updateState('a', { value: 'imported' });
    session.updateState('b', { value: 'typed', isDirty: true });

    const result = session.reviewValues(['a', 'b', 'missing']);

    expect(result).toEqual({
      appliedNodeIds: ['a'],
      blockedConflictNodeIds: [],
      preservedDirtyNodeIds: ['b'],
      preservedLockedNodeIds: [],
      preservedSubmittedNodeIds: [],
      missingNodeIds: ['missing'],
    });
    expect(session.getSnapshot()?.data.values['a']).toEqual({
      value: 'imported',
      protection: aiReviewedProtection,
    });
    expect(session.getSnapshot()?.data.values['b']).toEqual({
      value: 'typed',
      isDirty: true,
      protection: userFlexibleProtection,
    });
  });

  it('reviewValues blocks nodes with pending proposals', () => {
    const session = createSession();
    session.pushView(
      makeView([{ id: 'a', type: 'field', dataType: 'string' }])
    );

    session.updateState('a', { value: 'typed', isDirty: true });
    session.proposeValue('a', { value: 'ai-next' }, 'ai');

    const result = session.reviewValues(['a']);

    expect(result.blockedConflictNodeIds).toEqual(['a']);
    expect(session.getPendingProposals()['a']).toBeDefined();
  });

  it('lockValues clears proposals and marks the current value locked', () => {
    const session = createSession();
    session.pushView(
      makeView([{ id: 'a', type: 'field', dataType: 'string' }])
    );

    session.updateState('a', {
      value: 'approved',
      protection: aiReviewedProtection,
    });
    session.proposeValue('a', { value: 'ai-next' }, 'ai');

    const result = session.lockValues(['a']);

    expect(result.appliedNodeIds).toEqual(['a']);
    expect(session.getPendingProposals()).toEqual({});
    expect(session.getSnapshot()?.data.values['a']).toEqual({
      value: 'approved',
      protection: aiLockedProtection,
    });
  });

  it('unlockValues demotes reviewed and locked AI values back to flexible', () => {
    const session = createSession();
    session.pushView(
      makeView([
        { id: 'a', type: 'field', dataType: 'string' },
        { id: 'b', type: 'field', dataType: 'string' },
        { id: 'c', type: 'field', dataType: 'string' },
      ])
    );

    session.updateState('a', {
      value: 'reviewed',
      protection: aiReviewedProtection,
    });
    session.updateState('b', {
      value: 'locked',
      protection: aiLockedProtection,
    });
    session.updateState('c', { value: 'typed', isDirty: true });

    const result = session.unlockValues(['a', 'b', 'c']);

    expect(result).toEqual({
      appliedNodeIds: ['a', 'b'],
      blockedConflictNodeIds: [],
      preservedDirtyNodeIds: ['c'],
      preservedLockedNodeIds: [],
      preservedSubmittedNodeIds: [],
      missingNodeIds: [],
    });
    expect(session.getSnapshot()?.data.values['a']).toEqual({
      value: 'reviewed',
      protection: aiFlexibleProtection,
    });
    expect(session.getSnapshot()?.data.values['b']).toEqual({
      value: 'locked',
      protection: aiFlexibleProtection,
    });
    expect(session.getSnapshot()?.data.values['c']).toEqual({
      value: 'typed',
      isDirty: true,
      protection: userFlexibleProtection,
    });
  });

  it('submitValues marks current values submitted and prevents later unlocks', () => {
    const session = createSession();
    session.pushView(
      makeView([{ id: 'a', type: 'field', dataType: 'string' }])
    );

    session.updateState('a', { value: 'finalized' });

    const submitResult = session.submitValues(['a']);
    expect(submitResult.appliedNodeIds).toEqual(['a']);
    expect(session.getSnapshot()?.data.values['a']).toEqual({
      value: 'finalized',
      protection: aiSubmittedProtection,
    });

    const unlockResult = session.unlockValues(['a']);
    expect(unlockResult.preservedSubmittedNodeIds).toEqual(['a']);
    expect(session.getSnapshot()?.data.values['a']).toEqual({
      value: 'finalized',
      protection: aiSubmittedProtection,
    });
  });
});
