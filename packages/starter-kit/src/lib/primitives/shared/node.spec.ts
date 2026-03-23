import { describe, expect, it } from 'vitest';
import { nodeOptionKey, scalarFieldDisplayString } from './node.js';

describe('nodeOptionKey', () => {
  it('stays unique when generated options repeat values', () => {
    const first = nodeOptionKey(
      {
        value: 'yes',
        label: 'Yes',
      },
      0
    );
    const second = nodeOptionKey(
      {
        value: 'yes',
        label: 'Yes',
      },
      1
    );

    expect(first).not.toBe(second);
  });
});

describe('scalarFieldDisplayString', () => {
  it('renders number fields when the value is a numeric string', () => {
    expect(scalarFieldDisplayString('199060.82', 'number')).toBe('199060.82');
    expect(scalarFieldDisplayString(' 42 ', 'number')).toBe('42');
  });

  it('renders number fields when the value is already a number', () => {
    expect(scalarFieldDisplayString(67870, 'number')).toBe('67870');
  });

  it('uses string rules for string data type', () => {
    expect(scalarFieldDisplayString('hello', 'string')).toBe('hello');
    expect(scalarFieldDisplayString(12, 'string')).toBe('12');
  });
});
