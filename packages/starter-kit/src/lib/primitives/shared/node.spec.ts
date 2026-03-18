import { describe, expect, it } from 'vitest';
import { nodeOptionKey } from './node.js';

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
