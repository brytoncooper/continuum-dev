import type { InferUIMessageChunk, UIMessage } from 'ai';
import type {
  ContinuumTransformPlan,
  ViewNode,
  NodeValue,
  SessionStream,
  SessionStreamMode,
  SessionStreamPart,
  SessionStreamResult,
  SessionStreamStartOptions,
  SessionViewApplyOptions,
  ViewDefinition,
} from '@continuum-dev/core';
import type {
  ContinuumViewPatch,
  ContinuumViewPatchPosition,
} from '@continuum-dev/protocol';

export type ContinuumVercelAiSdkStatusLevel =
  | 'info'
  | 'success'
  | 'warning'
  | 'error';

export interface ContinuumVercelAiSdkMessageMetadata {
  label?: string;
}

export interface ContinuumVercelAiSdkViewData {
  view: ViewDefinition;
  transformPlan?: ContinuumTransformPlan;
  streamMode?: SessionStreamMode;
}

export interface ContinuumVercelAiSdkStateData {
  nodeId: string;
  value: NodeValue;
  streamMode?: SessionStreamMode;
}

export interface ContinuumVercelAiSdkPatchData {
  patch: ContinuumViewPatch;
  streamMode?: SessionStreamMode;
}

export interface ContinuumVercelAiSdkInsertNodeData {
  node: ViewNode;
  parentId?: string | null;
  position?: ContinuumViewPatchPosition;
  targetViewId?: string;
  streamMode?: SessionStreamMode;
}

export interface ContinuumVercelAiSdkReplaceNodeData {
  nodeId: string;
  node: ViewNode;
  targetViewId?: string;
  streamMode?: SessionStreamMode;
}

export interface ContinuumVercelAiSdkRemoveNodeData {
  nodeId: string;
  targetViewId?: string;
  streamMode?: SessionStreamMode;
}

export interface ContinuumVercelAiSdkAppendContentData {
  nodeId: string;
  text: string;
  targetViewId?: string;
  streamMode?: SessionStreamMode;
}

export interface ContinuumVercelAiSdkResetData {
  reason?: string;
}

export interface ContinuumVercelAiSdkStatusData {
  status: string;
  level?: ContinuumVercelAiSdkStatusLevel;
  streamMode?: SessionStreamMode;
}

export interface ContinuumVercelAiSdkNodeStatusData {
  nodeId: string;
  status: string;
  level?: ContinuumVercelAiSdkStatusLevel;
  subtree?: boolean;
  targetViewId?: string;
  streamMode?: SessionStreamMode;
}

export type ContinuumVercelAiSdkDataParts = Record<string, unknown> & {
  'continuum-view': ContinuumVercelAiSdkViewData;
  'continuum-patch': ContinuumVercelAiSdkPatchData;
  'continuum-insert-node': ContinuumVercelAiSdkInsertNodeData;
  'continuum-replace-node': ContinuumVercelAiSdkReplaceNodeData;
  'continuum-remove-node': ContinuumVercelAiSdkRemoveNodeData;
  'continuum-append-content': ContinuumVercelAiSdkAppendContentData;
  'continuum-state': ContinuumVercelAiSdkStateData;
  'continuum-reset': ContinuumVercelAiSdkResetData;
  'continuum-status': ContinuumVercelAiSdkStatusData;
  'continuum-node-status': ContinuumVercelAiSdkNodeStatusData;
};

export type ContinuumVercelAiSdkMessage = UIMessage<
  ContinuumVercelAiSdkMessageMetadata,
  ContinuumVercelAiSdkDataParts
>;

export type ContinuumVercelAiSdkViewPart = {
  type: 'data-continuum-view';
  id?: string;
  data: ContinuumVercelAiSdkViewData;
};

export type ContinuumVercelAiSdkStatePart = {
  type: 'data-continuum-state';
  id?: string;
  data: ContinuumVercelAiSdkStateData;
};

export type ContinuumVercelAiSdkPatchPart = {
  type: 'data-continuum-patch';
  id?: string;
  data: ContinuumVercelAiSdkPatchData;
};

export type ContinuumVercelAiSdkInsertNodePart = {
  type: 'data-continuum-insert-node';
  id?: string;
  data: ContinuumVercelAiSdkInsertNodeData;
};

export type ContinuumVercelAiSdkReplaceNodePart = {
  type: 'data-continuum-replace-node';
  id?: string;
  data: ContinuumVercelAiSdkReplaceNodeData;
};

export type ContinuumVercelAiSdkRemoveNodePart = {
  type: 'data-continuum-remove-node';
  id?: string;
  data: ContinuumVercelAiSdkRemoveNodeData;
};

export type ContinuumVercelAiSdkAppendContentPart = {
  type: 'data-continuum-append-content';
  id?: string;
  data: ContinuumVercelAiSdkAppendContentData;
};

export type ContinuumVercelAiSdkResetPart = {
  type: 'data-continuum-reset';
  id?: string;
  data: ContinuumVercelAiSdkResetData;
};

export type ContinuumVercelAiSdkStatusPart = {
  type: 'data-continuum-status';
  id?: string;
  data: ContinuumVercelAiSdkStatusData;
};

export type ContinuumVercelAiSdkNodeStatusPart = {
  type: 'data-continuum-node-status';
  id?: string;
  data: ContinuumVercelAiSdkNodeStatusData;
};

export type ContinuumVercelAiSdkDataPart =
  | ContinuumVercelAiSdkViewPart
  | ContinuumVercelAiSdkPatchPart
  | ContinuumVercelAiSdkInsertNodePart
  | ContinuumVercelAiSdkReplaceNodePart
  | ContinuumVercelAiSdkRemoveNodePart
  | ContinuumVercelAiSdkAppendContentPart
  | ContinuumVercelAiSdkStatePart
  | ContinuumVercelAiSdkResetPart
  | ContinuumVercelAiSdkStatusPart
  | ContinuumVercelAiSdkNodeStatusPart;

export type ContinuumVercelAiSdkDataChunk =
  | (ContinuumVercelAiSdkViewPart & { transient?: boolean })
  | (ContinuumVercelAiSdkPatchPart & { transient?: boolean })
  | (ContinuumVercelAiSdkInsertNodePart & { transient?: boolean })
  | (ContinuumVercelAiSdkReplaceNodePart & { transient?: boolean })
  | (ContinuumVercelAiSdkRemoveNodePart & { transient?: boolean })
  | (ContinuumVercelAiSdkAppendContentPart & { transient?: boolean })
  | (ContinuumVercelAiSdkStatePart & { transient?: boolean })
  | (ContinuumVercelAiSdkResetPart & { transient?: boolean })
  | (ContinuumVercelAiSdkStatusPart & { transient?: boolean })
  | (ContinuumVercelAiSdkNodeStatusPart & { transient?: boolean });

export type ContinuumVercelAiSdkMessageChunk =
  | InferUIMessageChunk<ContinuumVercelAiSdkMessage>
  | ContinuumVercelAiSdkDataChunk;

export interface ContinuumVercelAiSdkSnapshotLike {
  view: ViewDefinition;
}

export interface ContinuumVercelAiSdkSessionLike {
  readonly sessionId: string;
  getSnapshot(): ContinuumVercelAiSdkSnapshotLike | null | undefined;
  getCommittedSnapshot?(): ContinuumVercelAiSdkSnapshotLike | null | undefined;
  updateState(nodeId: string, value: NodeValue): void;
  proposeValue?(nodeId: string, value: NodeValue, source?: string): void;
  applyView?(view: ViewDefinition, options?: SessionViewApplyOptions): void;
  pushView?(view: ViewDefinition, options?: SessionViewApplyOptions): void;
  beginStream?(options: SessionStreamStartOptions): SessionStream;
  applyStreamPart?(streamId: string, part: SessionStreamPart): void;
  commitStream?(streamId: string): SessionStreamResult;
  abortStream?(streamId: string, reason?: string): SessionStreamResult;
  getStreams?(): SessionStream[];
  reset?(): void;
}

export interface ContinuumVercelAiSdkSessionAdapter {
  readonly sessionId: string;
  getSnapshot(): ContinuumVercelAiSdkSnapshotLike | null | undefined;
  getCommittedSnapshot(): ContinuumVercelAiSdkSnapshotLike | null | undefined;
  applyView(view: ViewDefinition, options?: SessionViewApplyOptions): void;
  updateState(nodeId: string, value: NodeValue): void;
  proposeValue?(nodeId: string, value: NodeValue, source?: string): void;
  beginStream?(options: SessionStreamStartOptions): SessionStream;
  applyStreamPart?(streamId: string, part: SessionStreamPart): void;
  commitStream?(streamId: string): SessionStreamResult;
  abortStream?(streamId: string, reason?: string): SessionStreamResult;
  getStreams?(): SessionStream[];
  reset?(): void;
}

export type ContinuumVercelAiSdkPartApplication =
  | {
      kind: 'view';
      view: ViewDefinition;
      transformPlan?: ContinuumTransformPlan;
      transient?: boolean;
      streamMode?: SessionStreamMode;
      streamId?: string;
    }
  | {
      kind: 'patch';
      patch: ContinuumViewPatch;
      transient?: boolean;
      streamMode?: SessionStreamMode;
      streamId?: string;
    }
  | {
      kind: 'insert-node';
      node: ViewNode;
      parentId?: string | null;
      position?: ContinuumViewPatchPosition;
      targetViewId?: string;
      transient?: boolean;
      streamMode?: SessionStreamMode;
      streamId?: string;
    }
  | {
      kind: 'replace-node';
      nodeId: string;
      node: ViewNode;
      targetViewId?: string;
      transient?: boolean;
      streamMode?: SessionStreamMode;
      streamId?: string;
    }
  | {
      kind: 'remove-node';
      nodeId: string;
      targetViewId?: string;
      transient?: boolean;
      streamMode?: SessionStreamMode;
      streamId?: string;
    }
  | {
      kind: 'append-content';
      nodeId: string;
      text: string;
      targetViewId?: string;
      transient?: boolean;
      streamMode?: SessionStreamMode;
      streamId?: string;
    }
  | {
      kind: 'state';
      nodeId: string;
      value: NodeValue;
      transient?: boolean;
      streamMode?: SessionStreamMode;
      streamId?: string;
    }
  | {
      kind: 'reset';
      reason?: string;
      streamId?: string;
    }
  | {
      kind: 'status';
      status: string;
      level: ContinuumVercelAiSdkStatusLevel;
      transient?: boolean;
      streamMode?: SessionStreamMode;
      streamId?: string;
    }
  | {
      kind: 'node-status';
      nodeId: string;
      status: string;
      level: ContinuumVercelAiSdkStatusLevel;
      subtree?: boolean;
      targetViewId?: string;
      transient?: boolean;
      streamMode?: SessionStreamMode;
      streamId?: string;
    }
  | {
      kind: 'ignored';
      reason: string;
      streamId?: string;
    };
