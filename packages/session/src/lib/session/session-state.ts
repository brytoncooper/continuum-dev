import type {
  ContinuitySnapshot,
  Interaction,
  PendingIntent,
  Checkpoint,
  ViewDefinition,
  DataSnapshot,
} from '@continuum/contract';
import type {
  ReconciliationIssue,
  ReconciliationOptions,
  ReconciliationResolution,
  StateDiff,
} from '@continuum/runtime';

export interface SessionState {
  sessionId: string;
  clock: () => number;
  maxEventLogSize: number;
  maxPendingIntents: number;
  maxCheckpoints: number;
  reconciliationOptions?: Omit<ReconciliationOptions, 'clock'>;
  validateOnUpdate: boolean;
  currentView: ViewDefinition | null;
  currentData: DataSnapshot | null;
  priorView: ViewDefinition | null;
  issues: ReconciliationIssue[];
  diffs: StateDiff[];
  resolutions: ReconciliationResolution[];
  eventLog: Interaction[];
  pendingIntents: PendingIntent[];
  checkpoints: Checkpoint[];
  snapshotListeners: Set<(snapshot: ContinuitySnapshot) => void>;
  issueListeners: Set<(issues: ReconciliationIssue[]) => void>;
  destroyed: boolean;
}

export function createEmptySessionState(sessionId: string, clock: () => number): SessionState {
  return {
    sessionId,
    clock,
    maxEventLogSize: 1000,
    maxPendingIntents: 500,
    maxCheckpoints: 50,
    reconciliationOptions: undefined,
    validateOnUpdate: false,
    currentView: null,
    currentData: null,
    priorView: null,
    issues: [],
    diffs: [],
    resolutions: [],
    eventLog: [],
    pendingIntents: [],
    checkpoints: [],
    snapshotListeners: new Set(),
    issueListeners: new Set(),
    destroyed: false,
  };
}

export function resetSessionState(internal: SessionState): void {
  internal.currentView = null;
  internal.currentData = null;
  internal.priorView = null;
  internal.issues = [];
  internal.diffs = [];
  internal.resolutions = [];
  internal.eventLog = [];
  internal.pendingIntents = [];
  internal.checkpoints = [];
}

export function replaceInternalState(
  internal: SessionState,
  next: SessionState
): void {
  internal.currentView = next.currentView;
  internal.currentData = next.currentData;
  internal.priorView = next.priorView;
  internal.issues = next.issues;
  internal.diffs = next.diffs;
  internal.resolutions = next.resolutions;
  internal.eventLog = next.eventLog;
  internal.pendingIntents = next.pendingIntents;
  internal.checkpoints = next.checkpoints;
  internal.validateOnUpdate = next.validateOnUpdate;
  internal.reconciliationOptions = next.reconciliationOptions;
}

export function generateId(prefix: string, clock: () => number): string {
  const randomPart = globalThis.crypto.randomUUID().replace(/-/g, '');
  return `${prefix}_${clock()}_${randomPart}`;
}
