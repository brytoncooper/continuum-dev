import type {
  ContinuumVercelAiSdkSessionAdapter,
  ContinuumVercelAiSdkSessionLike,
} from './types.js';

const adapterCache = new WeakMap<object, ContinuumVercelAiSdkSessionAdapter>();

function hasApplyView(
  session:
    | ContinuumVercelAiSdkSessionLike
    | ContinuumVercelAiSdkSessionAdapter
): session is ContinuumVercelAiSdkSessionAdapter {
  return typeof session.applyView === 'function';
}

function hasStreamSupport(
  session:
    | ContinuumVercelAiSdkSessionLike
    | ContinuumVercelAiSdkSessionAdapter
): session is ContinuumVercelAiSdkSessionAdapter &
  Required<
    Pick<
      ContinuumVercelAiSdkSessionAdapter,
      'beginStream' | 'applyStreamPart' | 'commitStream'
    >
  > {
  return (
    typeof session.beginStream === 'function' &&
    typeof session.applyStreamPart === 'function' &&
    typeof session.commitStream === 'function'
  );
}

export function createContinuumVercelAiSdkSessionAdapter(
  session:
    | ContinuumVercelAiSdkSessionLike
    | ContinuumVercelAiSdkSessionAdapter
): ContinuumVercelAiSdkSessionAdapter {
  if (typeof session === 'object' && session !== null) {
    const cached = adapterCache.get(session as object);
    if (cached) {
      return cached;
    }
  }

  const applyPatchedView = (
    view: Parameters<ContinuumVercelAiSdkSessionAdapter['applyView']>[0],
    options?: Parameters<ContinuumVercelAiSdkSessionAdapter['applyView']>[1]
  ) => {
    if (hasApplyView(session)) {
      session.applyView(view, options);
      return;
    }

    session.pushView?.(view, options);
  };

  if (!hasApplyView(session) && typeof session.pushView !== 'function') {
    throw new Error(
      'Continuum Vercel AI SDK session adapter requires either applyView(view) or pushView(view).'
    );
  }

  const beginStream =
    typeof session.beginStream === 'function'
      ? session.beginStream.bind(session)
      : undefined;
  const applyStreamPart =
    typeof session.applyStreamPart === 'function'
      ? session.applyStreamPart.bind(session)
      : undefined;
  const commitStream =
    typeof session.commitStream === 'function'
      ? session.commitStream.bind(session)
      : undefined;
  const abortStream =
    typeof session.abortStream === 'function'
      ? session.abortStream.bind(session)
      : undefined;
  const getStreams =
    typeof session.getStreams === 'function'
      ? session.getStreams.bind(session)
      : undefined;

  const adapter: ContinuumVercelAiSdkSessionAdapter = {
    sessionId: session.sessionId,
    getSnapshot: () => session.getSnapshot(),
    getCommittedSnapshot: () => session.getCommittedSnapshot?.(),
    applyView: applyPatchedView,
    updateState: (nodeId, value) => session.updateState(nodeId, value),
    proposeValue:
      typeof session.proposeValue === 'function'
        ? (nodeId, value, source) => session.proposeValue?.(nodeId, value, source)
        : undefined,
    beginStream,
    applyStreamPart,
    commitStream,
    abortStream,
    getStreams,
    reset:
      typeof session.reset === 'function' ? () => session.reset?.() : undefined,
  };

  if (typeof session === 'object' && session !== null) {
    adapterCache.set(session as object, adapter);
  }

  return adapter;
}

export function adapterSupportsContinuumStreams(
  session:
    | ContinuumVercelAiSdkSessionLike
    | ContinuumVercelAiSdkSessionAdapter
): session is ContinuumVercelAiSdkSessionAdapter &
  Required<
    Pick<
      ContinuumVercelAiSdkSessionAdapter,
      'beginStream' | 'applyStreamPart' | 'commitStream'
    >
  > {
  return hasStreamSupport(session);
}
