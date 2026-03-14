import type {
  ContinuumVercelAiSdkSessionAdapter,
  ContinuumVercelAiSdkSessionLike,
} from './types.js';
import { patchViewDefinition } from '@continuum-dev/core';

function hasApplyView(
  session:
    | ContinuumVercelAiSdkSessionLike
    | ContinuumVercelAiSdkSessionAdapter
): session is ContinuumVercelAiSdkSessionAdapter {
  return typeof session.applyView === 'function';
}

export function createContinuumVercelAiSdkSessionAdapter(
  session:
    | ContinuumVercelAiSdkSessionLike
    | ContinuumVercelAiSdkSessionAdapter
): ContinuumVercelAiSdkSessionAdapter {
  const applyPatchedView = (
    view: Parameters<ContinuumVercelAiSdkSessionAdapter['applyView']>[0],
    options?: Parameters<ContinuumVercelAiSdkSessionAdapter['applyView']>[1]
  ) => {
    const previousView = session.getSnapshot()?.view;
    const patchedView = patchViewDefinition(previousView, view);

    if (hasApplyView(session)) {
      session.applyView(patchedView, options);
      return;
    }

    session.pushView?.(patchedView, options);
  };

  if (hasApplyView(session)) {
    return {
      sessionId: session.sessionId,
      getSnapshot: () => session.getSnapshot(),
      applyView: applyPatchedView,
      updateState: (nodeId, value) => session.updateState(nodeId, value),
      proposeValue:
        typeof session.proposeValue === 'function'
          ? (nodeId, value, source) => session.proposeValue?.(nodeId, value, source)
          : undefined,
      reset:
        typeof session.reset === 'function' ? () => session.reset?.() : undefined,
    };
  }

  if (typeof session.pushView !== 'function') {
    throw new Error(
      'Continuum Vercel AI SDK session adapter requires either applyView(view) or pushView(view).'
    );
  }

  return {
    sessionId: session.sessionId,
    getSnapshot: () => session.getSnapshot(),
    applyView: applyPatchedView,
    updateState: (nodeId, value) => session.updateState(nodeId, value),
    proposeValue:
      typeof session.proposeValue === 'function'
        ? (nodeId, value, source) => session.proposeValue?.(nodeId, value, source)
        : undefined,
    reset:
      typeof session.reset === 'function' ? () => session.reset?.() : undefined,
  };
}
