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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function assertArrayField(
  data: Record<string, unknown>,
  field: keyof SerializedSessionData
): void {
  const value = data[field as string];
  if (value !== undefined && !Array.isArray(value)) {
    throw new Error(`Invalid serialized session: "${String(field)}" must be an array`);
  }
}

function assertObjectOrNullField(
  data: Record<string, unknown>,
  field: 'currentSchema' | 'currentState' | 'priorSchema'
): void {
  const value = data[field];
  if (value !== undefined && value !== null && !isRecord(value)) {
    throw new Error(`Invalid serialized session: "${field}" must be an object or null`);
  }
}

function validateSerializedSessionData(data: unknown): asserts data is SerializedSessionData {
  if (!isRecord(data)) {
    throw new Error('Invalid serialized session: expected an object');
  }

  if (typeof data.sessionId !== 'string') {
    throw new Error('Invalid serialized session: "sessionId" must be a string');
  }

  if (
    data.formatVersion !== undefined &&
    typeof data.formatVersion !== 'number'
  ) {
    throw new Error('Invalid serialized session: "formatVersion" must be a number');
  }

  assertObjectOrNullField(data, 'currentSchema');
  assertObjectOrNullField(data, 'currentState');
  assertObjectOrNullField(data, 'priorSchema');
  assertArrayField(data, 'eventLog');
  assertArrayField(data, 'pendingActions');
  assertArrayField(data, 'checkpoints');
  assertArrayField(data, 'issues');
  assertArrayField(data, 'diffs');
  assertArrayField(data, 'trace');
}

export function deserializeToState(
  data: unknown,
  clock: () => number
): SessionState {
  validateSerializedSessionData(data);
  const raw = data;

  if (raw.formatVersion !== undefined && raw.formatVersion > CURRENT_FORMAT_VERSION) {
    throw new Error(
      `Unsupported format version ${raw.formatVersion}. This runtime supports up to version ${CURRENT_FORMAT_VERSION}.`
    );
  }

  return {
    sessionId: raw.sessionId,
    clock,
    currentSchema: raw.currentSchema ?? null,
    currentState: raw.currentState ?? null,
    priorSchema: raw.priorSchema ?? null,
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
