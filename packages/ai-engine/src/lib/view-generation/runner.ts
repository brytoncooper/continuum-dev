import { getAvailableContinuumExecutionModes } from '../continuum-execution/index.mjs';
import {
  buildStarterKitPatchTargetCatalog,
  buildStarterKitStateTargetCatalog,
} from '../execution-targets/index.js';
import { buildDetachedFieldHints } from '../view-patching/index.js';
import { generateFullView } from './full-view-mode.js';
import { buildPatchContext, tryRunPatchMode } from './patch-mode.js';
import { planExecutionMode } from './planning.js';
import { tryRunStateMode } from './state-mode.js';
import type {
  StarterKitRunViewGenerationArgs,
  StarterKitRunViewGenerationResult,
} from './types.js';

export async function runStarterKitViewGeneration(
  args: StarterKitRunViewGenerationArgs
): Promise<StarterKitRunViewGenerationResult> {
  const autoApplyView = args.autoApplyView ?? true;
  void args.outputContract;

  const snapshot = args.session.getSnapshot();
  if (!snapshot) {
    throw new Error('No active Continuum snapshot is available yet.');
  }

  const detachedFields = buildDetachedFieldHints(args.session.getDetachedValues());
  const issues = args.session.getIssues();
  const authoringFormat = args.authoringFormat ?? 'line-dsl';
  const patchContext = buildPatchContext(snapshot.view);
  const stateTargets = buildStarterKitStateTargetCatalog(snapshot.view);
  const patchTargets = buildStarterKitPatchTargetCatalog(snapshot.view);
  const availableExecutionModes = getAvailableContinuumExecutionModes({
    hasCurrentView: snapshot.view.nodes.length > 0,
    hasStateTargets: stateTargets.length > 0,
  });

  const executionPlan = await planExecutionMode({
    autoApplyView,
    provider: args.provider,
    availableExecutionModes,
    patchTargets,
    stateTargets,
    compactTree: patchContext.compactTree,
    currentData: snapshot.data.values,
    instruction: args.instruction,
  });
  const selectedTargets = [
    ...executionPlan.targetNodeIds,
    ...executionPlan.targetSemanticKeys,
  ];

  if (executionPlan.mode === 'state') {
    const stateResult = await tryRunStateMode({
      autoApplyView,
      provider: args.provider,
      session: args.session,
      instruction: args.instruction,
      snapshot,
      stateTargets,
      selectedTargets,
    });
    if (stateResult) {
      return stateResult;
    }
  }

  let fullRunMode = args.mode;
  if (executionPlan.mode === 'patch') {
    const patchResult = await tryRunPatchMode({
      autoApplyView,
      provider: args.provider,
      session: args.session,
      instruction: args.instruction,
      snapshot,
      patchContext,
      detachedFields,
      selectedTargets,
    });
    if (patchResult.applied) {
      return patchResult.applied;
    }
    if (patchResult.nextFullRunMode) {
      fullRunMode = patchResult.nextFullRunMode;
    }
  }

  return generateFullView({
    provider: args.provider,
    session: args.session,
    snapshot,
    instruction: args.instruction,
    mode: fullRunMode,
    addons: args.addons,
    authoringFormat,
    autoApplyView,
    detachedFields,
    issues,
  });
}
