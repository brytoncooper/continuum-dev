import { describe, it, expect } from 'vitest';
import {
  addedDiff,
  removedDiff,
  typeChangedDiff,
  migratedDiff,
  addedTrace,
  carriedTrace,
  droppedTrace,
  migratedTrace,
} from './differ.js';

describe('diff factories', () => {
  it('addedDiff sets type to added with no old value', () => {
    const diff = addedDiff('comp-1');
    expect(diff.componentId).toBe('comp-1');
    expect(diff.type).toBe('added');
    expect(diff.oldValue).toBeUndefined();
    expect(diff.newValue).toBeUndefined();
  });

  it('removedDiff captures the old value', () => {
    const diff = removedDiff('comp-1', { value: 'hello' });
    expect(diff.componentId).toBe('comp-1');
    expect(diff.type).toBe('removed');
    expect(diff.oldValue).toEqual({ value: 'hello' });
  });

  it('typeChangedDiff includes both type names in the reason', () => {
    const diff = typeChangedDiff('comp-1', { value: 'hello' }, 'input', 'toggle');
    expect(diff.type).toBe('type-changed');
    expect(diff.oldValue).toEqual({ value: 'hello' });
    expect(diff.reason).toContain('input');
    expect(diff.reason).toContain('toggle');
  });

  it('migratedDiff captures both old and new values', () => {
    const diff = migratedDiff('comp-1', { value: 'old' }, { value: 'new' });
    expect(diff.type).toBe('migrated');
    expect(diff.oldValue).toEqual({ value: 'old' });
    expect(diff.newValue).toEqual({ value: 'new' });
  });
});

describe('trace factories', () => {
  it('addedTrace has null prior fields', () => {
    const trace = addedTrace('comp-1', 'input');
    expect(trace.componentId).toBe('comp-1');
    expect(trace.action).toBe('added');
    expect(trace.priorId).toBeNull();
    expect(trace.matchedBy).toBeNull();
    expect(trace.priorType).toBeNull();
    expect(trace.newType).toBe('input');
  });

  it('carriedTrace records match details and preserved value', () => {
    const trace = carriedTrace('new-id', 'old-id', 'key', 'input', 'hello', 'hello');
    expect(trace.action).toBe('carried');
    expect(trace.priorId).toBe('old-id');
    expect(trace.matchedBy).toBe('key');
    expect(trace.priorValue).toBe('hello');
    expect(trace.reconciledValue).toBe('hello');
  });

  it('droppedTrace clears reconciledValue', () => {
    const trace = droppedTrace('comp-1', 'comp-1', 'id', 'input', 'toggle', 'hello');
    expect(trace.action).toBe('dropped');
    expect(trace.reconciledValue).toBeUndefined();
    expect(trace.priorValue).toBe('hello');
  });

  it('migratedTrace captures both prior and migrated values', () => {
    const trace = migratedTrace('comp-1', 'comp-1', 'id', 'input', 'input', 'old', 'new');
    expect(trace.action).toBe('migrated');
    expect(trace.priorValue).toBe('old');
    expect(trace.reconciledValue).toBe('new');
  });
});
