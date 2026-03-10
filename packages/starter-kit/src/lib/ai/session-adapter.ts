import type { NodeValue, ViewDefinition } from '@continuum-dev/core';

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
  getDetachedValues(): Record<string, unknown>;
  getIssues(): unknown[];
  pushView(view: ViewDefinition): void;
  getPendingProposals(): Record<string, StarterKitPendingProposal>;
  acceptProposal(nodeId: string): void;
  rejectProposal(nodeId: string): void;
  rewind(checkpointId: string): void;
  reset(): void;
  updateState(nodeId: string, value: NodeValue): void;
}

export interface StarterKitSessionAdapter {
  readonly sessionId: string;
  getSnapshot(): StarterKitSessionSnapshot | undefined;
  getDetachedValues(): Record<string, unknown>;
  getIssues(): unknown[];
  applyView(view: ViewDefinition): void;
  getPendingProposals(): Record<string, StarterKitPendingProposal>;
  acceptProposal(nodeId: string): void;
  rejectProposal(nodeId: string): void;
  rewind(checkpointId: string): void;
  reset(): void;
  updateState(nodeId: string, value: NodeValue): void;
}

export function createStarterKitSessionAdapter(
  session: StarterKitSessionLike
): StarterKitSessionAdapter {
  return {
    sessionId: session.sessionId,
    getSnapshot: () => session.getSnapshot(),
    getDetachedValues: () => session.getDetachedValues(),
    getIssues: () => session.getIssues(),
    applyView: (view) => session.pushView(view),
    getPendingProposals: () => session.getPendingProposals(),
    acceptProposal: (nodeId) => session.acceptProposal(nodeId),
    rejectProposal: (nodeId) => session.rejectProposal(nodeId),
    rewind: (checkpointId) => session.rewind(checkpointId),
    reset: () => session.reset(),
    updateState: (nodeId, value) => session.updateState(nodeId, value),
  };
}
