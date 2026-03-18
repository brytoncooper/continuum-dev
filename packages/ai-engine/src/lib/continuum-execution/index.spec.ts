import { describe, expect, it } from 'vitest';
import {
  buildContinuumExecutionPlannerSystemPrompt,
  getAvailableContinuumExecutionModes,
  normalizeContinuumSemanticIdentity,
  parseContinuumExecutionPlan,
  resolveContinuumExecutionPlan,
} from './index.mjs';

describe('continuum execution entrypoint', () => {
  it('re-exports planner helpers', () => {
    expect(typeof buildContinuumExecutionPlannerSystemPrompt).toBe('function');
    expect(typeof getAvailableContinuumExecutionModes).toBe('function');
    expect(typeof parseContinuumExecutionPlan).toBe('function');
    expect(typeof resolveContinuumExecutionPlan).toBe('function');
  });

  it('re-exports semantic identity normalization', () => {
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
});
