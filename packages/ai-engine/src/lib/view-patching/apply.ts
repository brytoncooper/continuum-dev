import type { ViewDefinition } from '@continuum-dev/core';
import { patchViewDefinition } from '@continuum-dev/runtime';
import { applyContinuumViewStreamPart } from '@continuum-dev/runtime/state-ops';
import { normalizeViewPatchOperation } from './normalize.js';
import type { ViewPatchPlan } from './types.js';

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

  for (const rawOperation of plan.operations) {
    const operation = normalizeViewPatchOperation(rawOperation);
    if (!operation) {
      return null;
    }

    try {
      const result = applyContinuumViewStreamPart({
        currentView: nextView,
        part: operation,
      });
      nextView = result.view;
    } catch {
      return null;
    }
  }

  const finalizedView = patchViewDefinition(currentView, nextView);
  if (finalizedView === currentView) {
    return null;
  }

  return {
    ...finalizedView,
    version: bumpVersion(currentView.version),
  };
}
