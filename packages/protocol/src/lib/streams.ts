import type {
  ContinuitySnapshot,
  NodeValue,
  ViewDefinition,
  ViewNode,
} from '@continuum-dev/contract';
import type { ReconciliationIssue, ReconciliationResolution, StateDiff } from './reconciliation.js';
import type {
  ContinuumViewPatch,
  ContinuumViewPatchPosition,
} from './view-patch.js';
import type { ContinuumTransformPlan } from './transforms.js';

export type ContinuumViewStreamPart =
  | {
      kind: 'view';
      view: ViewDefinition;
      transformPlan?: ContinuumTransformPlan;
    }
  | {
      kind: 'patch';
      patch: ContinuumViewPatch;
    }
  | {
      kind: 'insert-node';
      parentId?: string | null;
      position?: ContinuumViewPatchPosition;
      node: ViewNode;
    }
  | {
      kind: 'move-node';
      nodeId: string;
      parentId?: string | null;
      position?: ContinuumViewPatchPosition;
    }
  | {
      kind: 'wrap-nodes';
      parentId?: string | null;
      nodeIds: string[];
      wrapper: ViewNode;
    }
  | {
      kind: 'replace-node';
      nodeId: string;
      node: ViewNode;
    }
  | {
      kind: 'remove-node';
      nodeId: string;
    }
  | {
      kind: 'append-content';
      nodeId: string;
      text: string;
    };

export interface SessionViewApplyOptions {
  transient?: boolean;
  transformPlan?: ContinuumTransformPlan;
}

export type SessionStreamMode = 'foreground' | 'draft';

export type SessionStreamStatus =
  | 'open'
  | 'committed'
  | 'aborted'
  | 'stale'
  | 'superseded';

export type SessionStreamStatusLevel =
  | 'info'
  | 'success'
  | 'warning'
  | 'error';

export interface SessionStreamStartOptions {
  streamId?: string;
  source?: string;
  targetViewId: string;
  baseViewVersion?: string | null;
  mode?: SessionStreamMode;
  supersede?: boolean;
  initialView?: ViewDefinition;
}

export type SessionStreamPart =
  | ContinuumViewStreamPart
  | {
      kind: 'state';
      nodeId: string;
      value: NodeValue;
      source?: string;
    }
  | {
      kind: 'status';
      status: string;
      level?: SessionStreamStatusLevel;
    }
  | {
      kind: 'node-status';
      nodeId: string;
      status: string;
      level?: SessionStreamStatusLevel;
      subtree?: boolean;
    };

export interface SessionStream {
  streamId: string;
  source?: string;
  targetViewId: string;
  baseViewVersion: string | null;
  mode: SessionStreamMode;
  status: SessionStreamStatus;
  startedAt: number;
  updatedAt: number;
  latestStatus?: {
    status: string;
    level: SessionStreamStatusLevel;
  };
  nodeStatuses: Record<
    string,
    {
      status: string;
      level: SessionStreamStatusLevel;
      subtree?: boolean;
    }
  >;
  previewData: ContinuitySnapshot['data'] | null;
  previewView: ViewDefinition | null;
  viewVersion?: string | null;
  affectedNodeIds: string[];
  partCount: number;
}

export interface SessionStreamResult {
  streamId: string;
  status: Exclude<SessionStreamStatus, 'open'>;
  reason?: string;
}

export interface SessionStreamDiagnostics {
  issues: ReconciliationIssue[];
  diffs: StateDiff[];
  resolutions: ReconciliationResolution[];
}
