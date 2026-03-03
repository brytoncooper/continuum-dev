import { describe, it, expect } from 'vitest';
import { createSession } from '../session.js';
import type { ViewDefinition, ViewNode } from '@continuum/contract';

function makeView(nodes: ViewNode[]): ViewDefinition {
  return { viewId: 'test-view', version: '1.0', nodes };
}

describe('Pending Proposals', () => {
  it('adds a proposal to getPendingProposals when proposeValue is called on a dirty field', () => {
    const session = createSession();
    session.pushView(makeView([{ id: 'f1', type: 'field', dataType: 'string' }]));
    
    // User edits the field (making it dirty)
    session.updateState('f1', { value: 'user-value', isDirty: true });
    
    // AI proposes a new value
    session.proposeValue('f1', { value: 'ai-value' }, 'ai');
    
    const proposals = session.getPendingProposals();
    const keys = Object.keys(proposals);
    expect(keys).toHaveLength(1);
    expect(proposals['f1'].nodeId).toBe('f1');
    expect(proposals['f1'].proposedValue).toEqual({ value: 'ai-value' });
    expect(proposals['f1'].currentValue).toEqual({ value: 'user-value', isDirty: true });
    expect(proposals['f1'].source).toBe('ai');
  });

  it('automatically applies the value instead of proposing if the field is clean', () => {
    const session = createSession();
    session.pushView(makeView([{ id: 'f1', type: 'field', dataType: 'string' }]));
    
    // Field is clean (only defaultValue or untouched)
    session.updateState('f1', { value: 'default-value', isDirty: false });
    
    // AI proposes a new value
    session.proposeValue('f1', { value: 'ai-value' }, 'ai');
    
    expect(Object.keys(session.getPendingProposals())).toHaveLength(0);
    expect(session.getSnapshot()?.data.values['f1']).toEqual({ value: 'ai-value' });
  });

  it('updates the node value and clears the proposal when acceptProposal is called', () => {
    const session = createSession();
    session.pushView(makeView([{ id: 'f1', type: 'field', dataType: 'string' }]));
    session.updateState('f1', { value: 'user-value', isDirty: true });
    session.proposeValue('f1', { value: 'ai-value' }, 'ai');
    
    expect(Object.keys(session.getPendingProposals())).toHaveLength(1);
    
    session.acceptProposal('f1');
    
    expect(Object.keys(session.getPendingProposals())).toHaveLength(0);
    expect(session.getSnapshot()?.data.values['f1']).toEqual({ 
      value: 'ai-value',
      isDirty: true // Should retain dirty status so it doesn't get overwritten easily later
    });
  });

  it('clears the proposal and leaves the node value alone when rejectProposal is called', () => {
    const session = createSession();
    session.pushView(makeView([{ id: 'f1', type: 'field', dataType: 'string' }]));
    session.updateState('f1', { value: 'user-value', isDirty: true });
    session.proposeValue('f1', { value: 'ai-value' }, 'ai');
    
    expect(Object.keys(session.getPendingProposals())).toHaveLength(1);
    
    session.rejectProposal('f1');
    
    expect(Object.keys(session.getPendingProposals())).toHaveLength(0);
    expect(session.getSnapshot()?.data.values['f1']).toEqual({ value: 'user-value', isDirty: true });
  });

  it('gracefully handles accepting or rejecting a non-existent proposal', () => {
    const session = createSession();
    session.pushView(makeView([{ id: 'f1', type: 'field', dataType: 'string' }]));
    
    expect(() => session.acceptProposal('f1')).not.toThrow();
    expect(() => session.rejectProposal('f1')).not.toThrow();
  });
});
