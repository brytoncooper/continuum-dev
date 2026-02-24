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
  currentSchema: SchemaSnapshot | null;
  currentState: StateSnapshot | null;
  priorSchema: SchemaSnapshot | null;
  issues: ReconciliationIssue[];
  diffs: StateDiff[];
  trace: ReconciliationTrace[];
  eventLog: Interaction[];
  pendingActions: PendingAction[];
  checkpoints: Checkpoint[];
  snapshotListeners: Set<(snapshot: ContinuitySnapshot) => void>;
  issueListeners: Set<(issues: ReconciliationIssue[]) => void>;
  destroyed: boolean;
}

export function createEmptySessionState(sessionId: string, clock: () => number): SessionState {
  return {
    sessionId,
    clock,
    currentSchema: null,
    currentState: null,
    priorSchema: null,
    issues: [],
    diffs: [],
    trace: [],
    eventLog: [],
    pendingActions: [],
    checkpoints: [],
    snapshotListeners: new Set(),
    issueListeners: new Set(),
    destroyed: false,
  };
}

export function generateId(prefix: string, clock: () => number): string {
  return `${prefix}_${clock()}_${Math.random().toString(36).substring(2, 9)}`;
}
