import type { InferUIMessageChunk, UIMessage } from 'ai';
import type {
  ContinuumViewPatch,
  NodeValue,
  SessionViewApplyOptions,
  ViewDefinition,
} from '@continuum-dev/core';

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
}

export interface ContinuumVercelAiSdkStateData {
  nodeId: string;
  value: NodeValue;
}

export interface ContinuumVercelAiSdkPatchData {
  patch: ContinuumViewPatch;
}

export interface ContinuumVercelAiSdkResetData {
  reason?: string;
}

export interface ContinuumVercelAiSdkStatusData {
  status: string;
  level?: ContinuumVercelAiSdkStatusLevel;
}

export type ContinuumVercelAiSdkDataParts = Record<string, unknown> & {
  'continuum-view': ContinuumVercelAiSdkViewData;
  'continuum-patch': ContinuumVercelAiSdkPatchData;
  'continuum-state': ContinuumVercelAiSdkStateData;
  'continuum-reset': ContinuumVercelAiSdkResetData;
  'continuum-status': ContinuumVercelAiSdkStatusData;
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

export type ContinuumVercelAiSdkDataPart =
  | ContinuumVercelAiSdkViewPart
  | ContinuumVercelAiSdkPatchPart
  | ContinuumVercelAiSdkStatePart
  | ContinuumVercelAiSdkResetPart
  | ContinuumVercelAiSdkStatusPart;

export type ContinuumVercelAiSdkDataChunk =
  | (ContinuumVercelAiSdkViewPart & { transient?: boolean })
  | (ContinuumVercelAiSdkPatchPart & { transient?: boolean })
  | (ContinuumVercelAiSdkStatePart & { transient?: boolean })
  | (ContinuumVercelAiSdkResetPart & { transient?: boolean })
  | (ContinuumVercelAiSdkStatusPart & { transient?: boolean });

export type ContinuumVercelAiSdkMessageChunk =
  | InferUIMessageChunk<ContinuumVercelAiSdkMessage>
  | ContinuumVercelAiSdkDataChunk;

export interface ContinuumVercelAiSdkSnapshotLike {
  view: ViewDefinition;
}

export interface ContinuumVercelAiSdkSessionLike {
  readonly sessionId: string;
  getSnapshot(): ContinuumVercelAiSdkSnapshotLike | null | undefined;
  updateState(nodeId: string, value: NodeValue): void;
  proposeValue?(nodeId: string, value: NodeValue, source?: string): void;
  applyView?(view: ViewDefinition, options?: SessionViewApplyOptions): void;
  pushView?(view: ViewDefinition, options?: SessionViewApplyOptions): void;
  reset?(): void;
}

export interface ContinuumVercelAiSdkSessionAdapter {
  readonly sessionId: string;
  getSnapshot(): ContinuumVercelAiSdkSnapshotLike | null | undefined;
  applyView(view: ViewDefinition, options?: SessionViewApplyOptions): void;
  updateState(nodeId: string, value: NodeValue): void;
  proposeValue?(nodeId: string, value: NodeValue, source?: string): void;
  reset?(): void;
}

export type ContinuumVercelAiSdkPartApplication =
  | {
      kind: 'view';
      view: ViewDefinition;
      transient?: boolean;
    }
  | {
      kind: 'patch';
      patch: ContinuumViewPatch;
      transient?: boolean;
    }
  | {
      kind: 'state';
      nodeId: string;
      value: NodeValue;
    }
  | {
      kind: 'reset';
      reason?: string;
    }
  | {
      kind: 'status';
      status: string;
      level: ContinuumVercelAiSdkStatusLevel;
    }
  | {
      kind: 'ignored';
      reason: string;
    };
