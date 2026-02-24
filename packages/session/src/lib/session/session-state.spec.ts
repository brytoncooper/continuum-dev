import { describe, it, expect } from 'vitest';
import { createEmptySessionState, generateId } from './session-state.js';

describe('createEmptySessionState', () => {
  it('returns state with the given session id and clock', () => {
    const clock = () => 5000;
    const state = createEmptySessionState('my-session', clock);

    expect(state.sessionId).toBe('my-session');
    expect(state.clock).toBe(clock);
  });

  it('initializes all collections as empty', () => {
    const state = createEmptySessionState('s', () => 0);

    expect(state.currentSchema).toBeNull();
    expect(state.currentState).toBeNull();
    expect(state.priorSchema).toBeNull();
    expect(state.issues).toEqual([]);
    expect(state.diffs).toEqual([]);
    expect(state.trace).toEqual([]);
    expect(state.eventLog).toEqual([]);
    expect(state.pendingActions).toEqual([]);
    expect(state.checkpoints).toEqual([]);
    expect(state.snapshotListeners.size).toBe(0);
    expect(state.issueListeners.size).toBe(0);
    expect(state.destroyed).toBe(false);
  });
});

describe('generateId', () => {
  it('includes the prefix and timestamp', () => {
    const id = generateId('test', () => 12345);
    expect(id).toMatch(/^test_12345_/);
  });

  it('produces unique ids across calls', () => {
    const clock = () => 1000;
    const id1 = generateId('x', clock);
    const id2 = generateId('x', clock);
    expect(id1).not.toBe(id2);
  });
});
