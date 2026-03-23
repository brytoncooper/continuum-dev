import { describe, expect, it } from 'vitest';
import { deepEqual } from './deep-equal.js';

describe('deepEqual', () => {
  it('matches primitives using Object.is semantics', () => {
    expect(deepEqual('invoice', 'invoice')).toBe(true);
    expect(deepEqual(Number.NaN, Number.NaN)).toBe(true);
    expect(deepEqual(1, '1')).toBe(false);
  });

  it('compares nested arrays recursively', () => {
    expect(
      deepEqual(
        ['summary', { children: ['body', 'footer'] }],
        ['summary', { children: ['body', 'footer'] }]
      )
    ).toBe(true);

    expect(
      deepEqual(
        ['summary', { children: ['body'] }],
        ['summary', { children: ['footer'] }]
      )
    ).toBe(false);

    expect(deepEqual(['summary'], ['summary', 'body'])).toBe(false);
  });

  it('treats plain objects with different key order as equal', () => {
    expect(
      deepEqual(
        { id: 'body', props: { hidden: false, label: 'Body' } },
        { props: { label: 'Body', hidden: false }, id: 'body' }
      )
    ).toBe(true);
  });

  it('rejects plain-object mismatches when only one side is an object', () => {
    expect(deepEqual({ id: 'summary' }, 'summary')).toBe(false);
  });

  it('rejects array-object mismatches and differing keys', () => {
    expect(deepEqual(['summary'], { 0: 'summary' })).toBe(false);
    expect(deepEqual({ id: 'summary' }, { id: 'summary', hidden: true })).toBe(
      false
    );
    expect(
      deepEqual(
        { id: 'summary', hidden: true },
        { id: 'summary', label: 'Summary' }
      )
    ).toBe(false);
  });
});
