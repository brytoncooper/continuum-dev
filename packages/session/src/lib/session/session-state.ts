import type {
  ContinuitySnapshot,
  Interaction,
  PendingAction,
  Checkpoint,
  SchemaSnapshot,
  StateSnapshot,
} from '@continuum/contract';
import type { ReconciliationIssue, ReconciliationTrace, StateDiff } from '@continuum/runtime';

export interface SessionState {
  sessionId: string;
  clock: () => number;
  maxEventLogSize: number;
  maxPendingActions: number;
  currentSchema: SchemaSnapshot | null;
  currentState: StateSnapshot | null;
  priorSchema: SchemaSnapshot | null;
  issues: ReconciliationIssue[];
  diffs: StateDiff[];
  trace: ReconciliationTrace[];
  eventLog: Interaction[];
  pendingActions: PendingAction[];
  checkpoints: Checkpoint[];
  autoCheckpointIds: Set<string>;
  snapshotListeners: Set<(snapshot: ContinuitySnapshot) => void>;
  issueListeners: Set<(issues: ReconciliationIssue[]) => void>;
  destroyed: boolean;
}

export function createEmptySessionState(sessionId: string, clock: () => number): SessionState {
  return {
    sessionId,
    clock,
    maxEventLogSize: 1000,
    maxPendingActions: 500,
    currentSchema: null,
    currentState: null,
    priorSchema: null,
    issues: [],
    diffs: [],
    trace: [],
    eventLog: [],
    pendingActions: [],
    checkpoints: [],
    autoCheckpointIds: new Set(),
    snapshotListeners: new Set(),
    issueListeners: new Set(),
    destroyed: false,
  };
}

export function resetSessionState(internal: SessionState): void {
  internal.currentSchema = null;
  internal.currentState = null;
  internal.priorSchema = null;
  internal.issues = [];
  internal.diffs = [];
  internal.trace = [];
  internal.eventLog = [];
  internal.pendingActions = [];
  internal.checkpoints = [];
  internal.autoCheckpointIds.clear();
}

export function generateId(prefix: string, clock: () => number): string {
  return `${prefix}_${clock()}_${Math.random().toString(36).substring(2, 9)}`;
}
