import { describe, expect, it } from 'vitest';
import {
  SCALAR_STATEFUL_NODE_TYPES,
  readNodeLabel,
  toCanonicalNodeId,
} from './shared.js';

describe('execution target shared helpers', () => {
  it('exposes the scalar stateful node types used by the catalogs', () => {
    expect(SCALAR_STATEFUL_NODE_TYPES.has('field')).toBe(true);
    expect(SCALAR_STATEFUL_NODE_TYPES.has('toggle')).toBe(true);
    expect(SCALAR_STATEFUL_NODE_TYPES.has('collection')).toBe(false);
  });

  it('builds canonical node ids from parent paths', () => {
    expect(toCanonicalNodeId('email')).toBe('email');
    expect(toCanonicalNodeId('email', 'profile/contact')).toBe(
      'profile/contact/email'
    );
  });

  it('reads string labels and ignores non-string labels', () => {
    expect(
      readNodeLabel({
        id: 'email',
        type: 'field',
        label: 'Email',
        dataType: 'string',
      })
    ).toBe('Email');

    expect(
      readNodeLabel({
        id: 'email',
        type: 'field',
        label: 42,
        dataType: 'string',
      } as never)
    ).toBeUndefined();
  });
});
