import {
  isViewDefinition,
  SUPPORTED_NODE_TYPE_VALUES,
} from '../../index.js';

describe('view-guardrails', () => {
  it('recognizes valid view definitions and exposes supported node types', () => {
    expect(
      isViewDefinition({
        viewId: 'profile',
        version: '1',
        nodes: [],
      })
    ).toBe(true);
    expect(
      isViewDefinition({
        viewId: 'profile',
        version: 1,
        nodes: [],
      })
    ).toBe(false);
    expect(SUPPORTED_NODE_TYPE_VALUES).toContain('collection');
  });
});
