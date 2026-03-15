import type { DataSnapshot, ViewDefinition } from '@continuum-dev/contract';
import type {
  ReconciliationIssue,
  ReconciliationResolution,
  StateDiff,
} from '@continuum-dev/runtime';
import type {
  SessionStreamMode,
  SessionStreamPart,
  SessionStreamStatus,
  SessionStreamStatusLevel,
} from '../../types.js';

export interface InternalSessionStreamState {
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
  workingView: ViewDefinition | null;
  workingData: DataSnapshot | null;
  issues: ReconciliationIssue[];
  diffs: StateDiff[];
  resolutions: ReconciliationResolution[];
  affectedNodeIds: Set<string>;
  parts: SessionStreamPart[];
  renderOnlyDirtyNodeIds: Set<string>;
}
