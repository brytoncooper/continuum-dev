import type { ViewDefinition } from '@continuum-dev/core';
import { applyContinuumViewStreamPart } from '@continuum-dev/runtime/view-stream';
import { deepEqual } from './deep-equal.js';
import { normalizeViewPatchOperation } from '../normalize/normalize.js';
import type { ViewPatchPlan } from '../types.js';

function bumpVersion(version: string): string {
  const asInt = Number(version);
  if (Number.isInteger(asInt) && String(asInt) === version) {
    return String(asInt + 1);
  }

  const suffixed = version.match(/^(.*?)(\d+)$/);
  if (suffixed) {
    return `${suffixed[1]}${Number(suffixed[2]) + 1}`;
  }

  return `${version}-next`;
}

export function applyPatchPlanToView(
  currentView: ViewDefinition,
  plan: ViewPatchPlan
): ViewDefinition | null {
  if (plan.mode !== 'patch' || plan.operations.length === 0) {
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
    version: bumpVersion(currentView.version),
  };
}
