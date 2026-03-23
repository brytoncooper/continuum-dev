import { describe, expect, it } from 'vitest';
import { isNodeWithinScope, toCanonicalId, toRelativeNodeId } from './paths.js';

describe('renderer paths', () => {
  it('builds canonical ids from parent scope', () => {
    expect(toCanonicalId('name', '')).toBe('name');
    expect(toCanonicalId('name', 'profile')).toBe('profile/name');
  });

  it('matches nodes within either ancestor direction of the same scope', () => {
    expect(isNodeWithinScope('profile/name', 'profile')).toBe(true);
    expect(isNodeWithinScope('profile', 'profile/name')).toBe(true);
    expect(isNodeWithinScope('profile/name', 'settings')).toBe(false);
  });

  it('derives relative ids only for descendants of the collection scope', () => {
    expect(toRelativeNodeId('items', 'items')).toBeNull();
    expect(toRelativeNodeId('items', 'items/row/name')).toBe('row/name');
    expect(toRelativeNodeId('items', 'other/name')).toBeNull();
  });
});
