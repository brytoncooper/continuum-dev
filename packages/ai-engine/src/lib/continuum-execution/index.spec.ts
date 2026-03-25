import { describe, expect, it } from 'vitest';
import { normalizeContinuumSemanticIdentity, parseJson } from './index.mjs';

describe('continuum-execution subpath', () => {
  it('exports semantic identity normalization', () => {
    const normalized = normalizeContinuumSemanticIdentity({
      currentView: {
        viewId: 'profile',
        version: '1',
        nodes: [],
      },
      nextView: {
        viewId: 'profile',
        version: '2',
        nodes: [],
      },
    });

    expect(normalized.errors).toEqual([]);
    expect(normalized.view).toEqual({
      viewId: 'profile',
      version: '2',
      nodes: [],
    });
  });

  it('exports parseJson for planner-side JSON recovery', () => {
    expect(parseJson('{"a":1}')).toEqual({ a: 1 });
  });
});
