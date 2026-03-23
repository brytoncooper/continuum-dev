import type { SessionStreamPart } from '@continuum-dev/core';
import {
  applyPatchPlanThroughUpdateParts,
  applyStateUpdatesThroughStreamingFoundation,
  applyThroughStreamingFoundation,
} from '../../view-generation/apply/apply.js';
import { applyPatchPlanToView } from '../../view-patching/index.js';
import type { ContinuumSessionAdapter } from '../../session/index.js';
import type { ContinuumExecutionFinalResult } from '../types.js';

export function applyContinuumExecutionFinalResult(
  session: ContinuumSessionAdapter,
  result: ContinuumExecutionFinalResult
): void {
  if (result.mode === 'state') {
    if (
      applyStateUpdatesThroughStreamingFoundation(
        session,
        result.source,
        result.currentView,
        result.updates
      )
    ) {
      return;
    }

    for (const update of result.updates) {
      session.proposeValue(update.nodeId, update.value, result.source);
    }
    return;
  }

  if (result.mode === 'patch') {
    if (
      applyPatchPlanThroughUpdateParts(
        session,
        result.source,
        result.currentView,
        result.patchPlan
      )
    ) {
      return;
    }

    const nextView = applyPatchPlanToView(result.currentView, result.patchPlan);
    if (!nextView) {
      throw new Error('Unable to apply the generated Continuum patch plan.');
    }

    session.applyView(nextView);
    return;
  }

  if (result.mode === 'noop') {
    return;
  }

  const viewPart: SessionStreamPart = {
    kind: 'view',
    view: result.view,
    ...(result.mode === 'transform'
      ? { transformPlan: result.transformPlan }
      : {}),
  };

  if (
    applyThroughStreamingFoundation(
      session,
      result.source,
      result.view.viewId,
      [viewPart],
      'draft'
    )
  ) {
    return;
  }

  session.applyView(
    result.view,
    result.mode === 'transform'
      ? { transformPlan: result.transformPlan }
      : undefined
  );
}
