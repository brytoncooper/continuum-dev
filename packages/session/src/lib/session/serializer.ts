import type {
  Interaction,
  PendingAction,
  Checkpoint,
  SchemaSnapshot,
  StateSnapshot,
} from '@continuum/contract';
import type { ReconciliationIssue, ReconciliationTrace, StateDiff } from '@continuum/runtime';
import type { SessionState } from './session-state.js';

const CURRENT_FORMAT_VERSION = 1;

export function serializeSession(internal: SessionState): unknown {
  return {
    formatVersion: CURRENT_FORMAT_VERSION,
    sessionId: internal.sessionId,
    currentSchema: internal.currentSchema,
    currentState: internal.currentState,
    priorSchema: internal.priorSchema,
    eventLog: internal.eventLog,
    pendingActions: internal.pendingActions,
    checkpoints: internal.checkpoints,
    issues: internal.issues,
    diffs: internal.diffs,
    trace: internal.trace,
  };
}

interface SerializedSessionData {
  formatVersion?: number;
  sessionId: string;
  currentSchema: SchemaSnapshot | null;
  currentState: StateSnapshot | null;
  priorSchema: SchemaSnapshot | null;
  eventLog: Interaction[];
  pendingActions: PendingAction[];
  checkpoints: Checkpoint[];
  issues: ReconciliationIssue[];
  diffs: StateDiff[];
  trace: ReconciliationTrace[];
}

export function deserializeToState(
  data: unknown,
  clock: () => number
): SessionState {
  const raw = data as SerializedSessionData;

  if (raw.formatVersion !== undefined && raw.formatVersion > CURRENT_FORMAT_VERSION) {
    throw new Error(
      `Unsupported format version ${raw.formatVersion}. This runtime supports up to version ${CURRENT_FORMAT_VERSION}.`
    );
  }

  return {
    sessionId: raw.sessionId,
    clock,
    currentSchema: raw.currentSchema,
    currentState: raw.currentState,
    priorSchema: raw.priorSchema,
    issues: raw.issues ?? [],
    diffs: raw.diffs ?? [],
    trace: raw.trace ?? [],
    eventLog: raw.eventLog ?? [],
    pendingActions: raw.pendingActions ?? [],
    checkpoints: raw.checkpoints ?? [],
    snapshotListeners: new Set(),
    issueListeners: new Set(),
    destroyed: false,
  };
}
