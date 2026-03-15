import type {
  NodeValue,
  SessionStream,
  SessionStreamPart,
  SessionStreamResult,
  SessionStreamStartOptions,
  SessionViewApplyOptions,
  ViewDefinition,
} from '@continuum-dev/core';

export interface StarterKitSessionSnapshot {
  view: ViewDefinition;
  data: {
    values: Record<string, NodeValue | undefined>;
  };
}

export interface StarterKitPendingProposal {
  proposedValue: NodeValue;
}

export interface StarterKitSessionLike {
  sessionId: string;
  getSnapshot(): StarterKitSessionSnapshot | undefined;
  getCommittedSnapshot?(): StarterKitSessionSnapshot | undefined;
  getDetachedValues(): Record<string, unknown>;
  getIssues(): unknown[];
  pushView(view: ViewDefinition, options?: SessionViewApplyOptions): void;
  beginStream?(options: SessionStreamStartOptions): SessionStream;
  applyStreamPart?(streamId: string, part: SessionStreamPart): void;
  commitStream?(streamId: string): SessionStreamResult;
  abortStream?(streamId: string, reason?: string): SessionStreamResult;
  getStreams?(): SessionStream[];
  getPendingProposals(): Record<string, StarterKitPendingProposal>;
  acceptProposal(nodeId: string): void;
  rejectProposal(nodeId: string): void;
  rewind(checkpointId: string): void;
  reset(): void;
  updateState(nodeId: string, value: NodeValue): void;
  proposeValue(nodeId: string, value: NodeValue, source?: string): void;
}

export interface StarterKitSessionAdapter {
  readonly sessionId: string;
  getSnapshot(): StarterKitSessionSnapshot | undefined;
  getCommittedSnapshot(): StarterKitSessionSnapshot | undefined;
  getDetachedValues(): Record<string, unknown>;
  getIssues(): unknown[];
  applyView(view: ViewDefinition, options?: SessionViewApplyOptions): void;
  beginStream?(options: SessionStreamStartOptions): SessionStream;
  applyStreamPart?(streamId: string, part: SessionStreamPart): void;
  commitStream?(streamId: string): SessionStreamResult;
  abortStream?(streamId: string, reason?: string): SessionStreamResult;
  getStreams?(): SessionStream[];
  getPendingProposals(): Record<string, StarterKitPendingProposal>;
  acceptProposal(nodeId: string): void;
  rejectProposal(nodeId: string): void;
  rewind(checkpointId: string): void;
  reset(): void;
  updateState(nodeId: string, value: NodeValue): void;
  proposeValue(nodeId: string, value: NodeValue, source?: string): void;
}

export function createStarterKitSessionAdapter(
  session: StarterKitSessionLike
): StarterKitSessionAdapter {
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

  return {
    sessionId: session.sessionId,
    getSnapshot: () => session.getSnapshot(),
    getCommittedSnapshot: () => session.getCommittedSnapshot?.(),
    getDetachedValues: () => session.getDetachedValues(),
    getIssues: () => session.getIssues(),
    applyView: (view, options) => session.pushView(view, options),
    beginStream,
    applyStreamPart,
    commitStream,
    abortStream,
    getStreams,
    getPendingProposals: () => session.getPendingProposals(),
    acceptProposal: (nodeId) => session.acceptProposal(nodeId),
    rejectProposal: (nodeId) => session.rejectProposal(nodeId),
    rewind: (checkpointId) => session.rewind(checkpointId),
    reset: () => session.reset(),
    updateState: (nodeId, value) => session.updateState(nodeId, value),
    proposeValue: (nodeId, value, source) =>
      session.proposeValue(nodeId, value, source),
  };
}
