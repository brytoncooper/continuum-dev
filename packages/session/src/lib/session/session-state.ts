import type {
  ContinuitySnapshot,
  Interaction,
  PendingIntent,
  Checkpoint,
  ViewDefinition,
  DataSnapshot,
  DetachedValuePolicy,
  ProposedValue,
  ActionRegistration,
  ActionHandler,
} from '@continuum-dev/contract';
import type {
  ReconciliationIssue,
  ReconciliationOptions,
  ReconciliationResolution,
  StateDiff,
} from '@continuum-dev/runtime';

/**
 * Internal mutable session backing state.
 *
 * This shape is not exported from the package barrel and is intended for
 * internal orchestration modules only.
 */
export interface SessionState {
  sessionId: string;
  clock: () => number;
  maxEventLogSize: number;
  maxPendingIntents: number;
  maxCheckpoints: number;
  reconciliationOptions?: Omit<ReconciliationOptions, 'clock'>;
  validateOnUpdate: boolean;
  detachedValuePolicy?: DetachedValuePolicy;
  stableViewVersion: string | null;
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
  pendingProposals: Record<string, ProposedValue>;
  actionRegistry: Map<
    string,
    { registration: ActionRegistration; handler: ActionHandler }
  >;
  destroyed: boolean;
}

/**
 * Creates default empty internal session state.
 *
 * @param sessionId Generated session id.
 * @param clock Clock source used for ids/timestamps.
 * @returns Initialized internal state object.
 */
export function createEmptySessionState(
  sessionId: string,
  clock: () => number
): SessionState {
  return {
    sessionId,
    clock,
    maxEventLogSize: 1000,
    maxPendingIntents: 500,
    maxCheckpoints: 50,
    reconciliationOptions: undefined,
    validateOnUpdate: false,
    stableViewVersion: null,
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
    pendingProposals: {},
    actionRegistry: new Map(),
    destroyed: false,
  };
}

/**
 * Resets active timeline data while preserving configuration and listeners.
 *
 * @param internal Mutable internal session state.
 */
export function resetSessionState(internal: SessionState): void {
  internal.currentView = null;
  internal.currentData = null;
  internal.priorView = null;
  internal.stableViewVersion = null;
  internal.issues = [];
  internal.diffs = [];
  internal.resolutions = [];
  internal.eventLog = [];
  internal.pendingIntents = [];
  internal.checkpoints = [];
  internal.pendingProposals = {};
}

/**
 * Replaces runtime portions of internal state from another state object.
 *
 * @param internal Destination state object.
 * @param next Source state values to apply.
 */
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
  internal.stableViewVersion = next.stableViewVersion;
}

/**
 * Generates a unique id using prefix, timestamp, and random UUID bytes.
 *
 * @param prefix Id namespace prefix.
 * @param clock Clock source used for timestamp component.
 * @returns Stable unique id string.
 */
export function generateId(prefix: string, clock: () => number): string {
  const randomPart = globalThis.crypto.randomUUID().replace(/-/g, '');
  return `${prefix}_${clock()}_${randomPart}`;
}
