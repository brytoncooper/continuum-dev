import type { ViewDefinition } from '@continuum-dev/core';
import { advanceContinuumViewVersion } from '@continuum-dev/protocol';
import { applyContinuumViewStreamPart } from '@continuum-dev/runtime/view-stream';
import { deepEqual } from './deep-equal.js';
import { normalizeViewPatchOperation } from '../normalize/normalize.js';
import type { ViewPatchPlan } from '../types.js';

export function applyPatchPlanToView(
  currentView: ViewDefinition,
  plan: ViewPatchPlan
): ViewDefinition | null {
  if (plan.operations.length === 0) {
    return null;
  }

  let nextView = structuredClone(currentView);
  let changed = false;

  for (const rawOperation of plan.operations) {
    const operation = normalizeViewPatchOperation(rawOperation);
    if (!operation) {
      return null;
    }

    try {
      const priorView = nextView;
      const result = applyContinuumViewStreamPart({
        currentView: nextView,
        part: operation,
      });
      changed = changed || result.view !== priorView;
      nextView = result.view;
    } catch {
      return null;
    }
  }

  if (!changed || deepEqual(nextView, currentView)) {
    return null;
  }

  return {
    ...nextView,
    version: advanceContinuumViewVersion(currentView.version, 'minor'),
  };
}
