import { describe, it, expect } from 'vitest';
import {
  addedDiff,
  removedDiff,
  typeChangedDiff,
  migratedDiff,
  addedResolution,
  carriedResolution,
  detachedResolution,
  migratedResolution,
} from './index.js';

describe('diff factories', () => {
  it('addedDiff sets type to added with no old value', () => {
    const diff = addedDiff('node-1');
    expect(diff.nodeId).toBe('node-1');
    expect(diff.type).toBe('added');
    expect(diff.oldValue).toBeUndefined();
    expect(diff.newValue).toBeUndefined();
  });

  it('removedDiff captures the old value', () => {
    const diff = removedDiff('node-1', { value: 'hello' });
    expect(diff.nodeId).toBe('node-1');
    expect(diff.type).toBe('removed');
    expect(diff.oldValue).toEqual({ value: 'hello' });
  });

  it('typeChangedDiff includes both type names in the reason', () => {
    const diff = typeChangedDiff('node-1', { value: 'hello' }, 'field', 'action');
    expect(diff.type).toBe('type-changed');
    expect(diff.oldValue).toEqual({ value: 'hello' });
    expect(diff.reason).toContain('field');
    expect(diff.reason).toContain('action');
  });

  it('migratedDiff captures both old and new values', () => {
    const diff = migratedDiff('node-1', { value: 'old' }, { value: 'new' });
    expect(diff.type).toBe('migrated');
    expect(diff.oldValue).toEqual({ value: 'old' });
    expect(diff.newValue).toEqual({ value: 'new' });
  });
});

describe('resolution factories', () => {
  it('addedResolution has null prior fields', () => {
    const res = addedResolution('node-1', 'field');
    expect(res.nodeId).toBe('node-1');
    expect(res.resolution).toBe('added');
    expect(res.priorId).toBeNull();
    expect(res.matchedBy).toBeNull();
    expect(res.priorType).toBeNull();
    expect(res.newType).toBe('field');
  });

  it('carriedResolution records match details and preserved value', () => {
    const res = carriedResolution('new-id', 'old-id', 'key', 'field', 'hello', 'hello');
    expect(res.resolution).toBe('carried');
    expect(res.priorId).toBe('old-id');
    expect(res.matchedBy).toBe('key');
    expect(res.priorValue).toBe('hello');
    expect(res.reconciledValue).toBe('hello');
  });

  it('detachedResolution clears reconciledValue', () => {
    const res = detachedResolution('node-1', 'node-1', 'id', 'field', 'action', 'hello');
    expect(res.resolution).toBe('detached');
    expect(res.reconciledValue).toBeUndefined();
    expect(res.priorValue).toBe('hello');
  });

  it('migratedResolution captures both prior and migrated values', () => {
    const res = migratedResolution('node-1', 'node-1', 'id', 'field', 'field', 'old', 'new');
    expect(res.resolution).toBe('migrated');
    expect(res.priorValue).toBe('old');
    expect(res.reconciledValue).toBe('new');
  });
});
