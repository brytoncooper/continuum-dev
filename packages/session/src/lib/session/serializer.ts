import type {
  Interaction,
  PendingIntent,
  Checkpoint,
  ViewDefinition,
  DataSnapshot,
} from '@continuum/contract';
import { isInteractionType } from '@continuum/contract';
import type { ReconciliationIssue, ReconciliationResolution, StateDiff } from '@continuum/runtime';
import type { SessionState } from './session-state.js';

const CURRENT_FORMAT_VERSION = 1;

function deepClone<T>(value: T): T {
  return structuredClone(value);
}

export function serializeSession(internal: SessionState): unknown {
  return deepClone({
    formatVersion: CURRENT_FORMAT_VERSION,
    sessionId: internal.sessionId,
    currentView: internal.currentView,
    currentData: internal.currentData,
    priorView: internal.priorView,
    eventLog: internal.eventLog,
    pendingIntents: internal.pendingIntents,
    checkpoints: internal.checkpoints,
    issues: internal.issues,
    diffs: internal.diffs,
    resolutions: internal.resolutions,
    settings: {
      allowBlindCarry: internal.reconciliationOptions?.allowBlindCarry,
      allowPartialRestore: internal.reconciliationOptions?.allowPartialRestore,
      validateOnUpdate: internal.validateOnUpdate,
    },
  });
}

interface SerializedSessionData {
  formatVersion?: number;
  sessionId: string;
  currentView: ViewDefinition | null;
  currentData: DataSnapshot | null;
  priorView: ViewDefinition | null;
  eventLog: Interaction[];
  pendingIntents: PendingIntent[];
  checkpoints: Checkpoint[];
  issues: ReconciliationIssue[];
  diffs: StateDiff[];
  resolutions: ReconciliationResolution[];
  settings?: {
    allowBlindCarry?: boolean;
    allowPartialRestore?: boolean;
    validateOnUpdate?: boolean;
  };
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
  field: 'currentView' | 'currentData' | 'priorView'
): void {
  const value = data[field];
  if (value !== undefined && value !== null && !isRecord(value)) {
    throw new Error(`Invalid serialized session: "${field}" must be an object or null`);
  }
}

function assertValidEventLogTypes(data: Record<string, unknown>): void {
  const value = data.eventLog;
  if (!Array.isArray(value)) return;
  for (let i = 0; i < value.length; i++) {
    const interaction = value[i];
    if (!isRecord(interaction)) {
      throw new Error(`Invalid serialized session: "eventLog[${i}]" must be an object`);
    }
    if (!isInteractionType(interaction.type)) {
      throw new Error(`Invalid serialized session: "eventLog[${i}].type" must be a valid interaction type`);
    }
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

  assertObjectOrNullField(data, 'currentView');
  assertObjectOrNullField(data, 'currentData');
  assertObjectOrNullField(data, 'priorView');
  assertArrayField(data, 'eventLog');
  assertArrayField(data, 'pendingIntents');
  assertArrayField(data, 'checkpoints');
  assertArrayField(data, 'issues');
  assertArrayField(data, 'diffs');
  assertArrayField(data, 'resolutions');
  assertValidEventLogTypes(data);
}

export function deserializeToState(
  data: unknown,
  clock: () => number,
  limits?: { maxEventLogSize?: number; maxPendingIntents?: number; maxCheckpoints?: number }
): SessionState {
  validateSerializedSessionData(data);
  const raw = data;

  if (raw.formatVersion !== undefined && raw.formatVersion !== CURRENT_FORMAT_VERSION) {
    throw new Error(
      `Unsupported format version ${raw.formatVersion}. This runtime supports version ${CURRENT_FORMAT_VERSION}.`
    );
  }

  return {
    sessionId: raw.sessionId,
    clock,
    maxEventLogSize: limits?.maxEventLogSize ?? 1000,
    maxPendingIntents: limits?.maxPendingIntents ?? 500,
    maxCheckpoints: limits?.maxCheckpoints ?? 50,
    reconciliationOptions: {
      allowBlindCarry: raw.settings?.allowBlindCarry,
      allowPartialRestore: raw.settings?.allowPartialRestore,
    },
    validateOnUpdate: raw.settings?.validateOnUpdate ?? false,
    currentView: raw.currentView ?? null,
    currentData: raw.currentData ?? null,
    priorView: raw.priorView ?? null,
    issues: raw.issues ?? [],
    diffs: raw.diffs ?? [],
    resolutions: raw.resolutions ?? [],
    eventLog: raw.eventLog ?? [],
    pendingIntents: raw.pendingIntents ?? [],
    checkpoints: raw.checkpoints ?? [],
    snapshotListeners: new Set(),
    issueListeners: new Set(),
    destroyed: false,
  };
}
