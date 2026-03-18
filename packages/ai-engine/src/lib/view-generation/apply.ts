import type { SessionStreamPart } from '@continuum-dev/core';
import type { ViewDefinition } from '@continuum-dev/core';
import type { ContinuumSessionAdapter } from '../session/index.js';
import {
  applyPatchPlanToView,
  isViewPatchPlan,
} from '../view-patching/index.js';
import { normalizeGeneratedView } from './normalize.js';

export function applyThroughStreamingFoundation(
  session: ContinuumSessionAdapter,
  source: string,
  targetViewId: string,
  parts: SessionStreamPart[],
  mode: 'foreground' | 'draft' = 'foreground'
): boolean {
  if (
    typeof session.beginStream !== 'function' ||
    typeof session.applyStreamPart !== 'function' ||
    typeof session.commitStream !== 'function'
  ) {
    return false;
  }

  const baseSnapshot = session.getCommittedSnapshot?.() ?? session.getSnapshot();
  const stream = session.beginStream({
    targetViewId,
    source,
    mode,
    supersede: true,
    baseViewVersion: baseSnapshot?.view.version ?? null,
  });

  for (const part of parts) {
    session.applyStreamPart(stream.streamId, part);
  }

  const result = session.commitStream(stream.streamId);
  if (result.status !== 'committed') {
    throw new Error(
      `Continuum stream commit failed with status "${result.status}"${
        result.reason ? `: ${result.reason}` : ''
      }.`
    );
  }

  return true;
}

export function applyStateUpdatesThroughStreamingFoundation(
  session: ContinuumSessionAdapter,
  source: string,
  currentView: ViewDefinition,
  updates: Array<{ nodeId: string; value: unknown }>
): boolean {
  return applyThroughStreamingFoundation(
    session,
    source,
    currentView.viewId,
    updates.map((update) => ({
      kind: 'state',
      nodeId: update.nodeId,
      value: update.value,
      source,
    })) as SessionStreamPart[]
  );
}

export function applyPatchPlanThroughUpdateParts(
  session: ContinuumSessionAdapter,
  source: string,
  currentView: ViewDefinition,
  plan: unknown
): boolean {
  if (
    !isViewPatchPlan(plan) ||
    plan.mode !== 'patch' ||
    plan.operations.length === 0
  ) {
    return false;
  }

  const parts = plan.operations.map((operation) => ({
    ...operation,
  })) as SessionStreamPart[];
  if (
    applyThroughStreamingFoundation(
      session,
      source,
      currentView.viewId,
      parts
    )
  ) {
    return true;
  }

  const nextView = applyPatchPlanToView(currentView, plan);
  if (!nextView) {
    return false;
  }

  session.applyView(normalizeGeneratedView(currentView, nextView));
  return true;
}
