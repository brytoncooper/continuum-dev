import type { ViewDefinition, DataSnapshot } from '@continuum-dev/contract';
import {
  isInteractionType,
  type Checkpoint,
  type Interaction,
  type PendingIntent,
} from '@continuum-dev/protocol';
import type {
  ReconciliationIssue,
  ReconciliationResolution,
  StateDiff,
} from '@continuum-dev/runtime';
import { sanitizeContinuumDataSnapshot } from '@continuum-dev/runtime/canonical-snapshot';
import type { SessionState } from './session-state.js';

const CURRENT_FORMAT_VERSION = 2;

function deepClone<T>(value: T): T {
  return structuredClone(value);
}

/**
 * Serializes internal session state into a JSON-compatible payload.
 *
 * @param internal Mutable internal session state.
 * @returns Deep-cloned serialized payload.
 */
export function serializeSession(internal: SessionState): unknown {
  return deepClone({
    formatVersion: CURRENT_FORMAT_VERSION,
    sessionId: internal.sessionId,
    currentView: internal.currentView,
    currentData: sanitizeContinuumDataSnapshot(internal.currentData),
    priorView: internal.priorView,
    eventLog: internal.eventLog,
    pendingIntents: internal.pendingIntents,
    checkpoints: sanitizeCheckpoints(internal.checkpoints),
    issues: internal.issues,
    diffs: internal.diffs,
    resolutions: internal.resolutions,
    settings: {
      allowPriorDataWithoutPriorView:
        internal.reconciliationOptions?.allowPriorDataWithoutPriorView,
      allowPartialRestore: internal.reconciliationOptions?.allowPartialRestore,
      validateOnUpdate: internal.validateOnUpdate,
      enableRestoreReviews: internal.restoreReviewsEnabled,
      stableViewVersion: internal.stableViewVersion,
    },
  });
}

interface SerializedSessionData {
  formatVersion: number;
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
    allowPriorDataWithoutPriorView?: boolean;
    allowBlindCarry?: boolean;
    allowPartialRestore?: boolean;
    validateOnUpdate?: boolean;
    enableRestoreReviews?: boolean;
    stableViewVersion?: string | null;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function sanitizeCheckpoints(checkpoints: Checkpoint[]): Checkpoint[] {
  return checkpoints.map((checkpoint) => ({
    ...checkpoint,
    snapshot: {
      ...checkpoint.snapshot,
      data: sanitizeContinuumDataSnapshot(checkpoint.snapshot.data)!,
    },
  }));
}

function assertArrayField(
  data: Record<string, unknown>,
  field: keyof SerializedSessionData
): void {
  const value = data[field as string];
  if (value !== undefined && !Array.isArray(value)) {
    throw new Error(
      `Invalid serialized session: "${String(field)}" must be an array`
    );
  }
}

function assertObjectOrNullField(
  data: Record<string, unknown>,
  field: 'currentView' | 'currentData' | 'priorView'
): void {
  const value = data[field];
  if (value !== undefined && value !== null && !isRecord(value)) {
    throw new Error(
      `Invalid serialized session: "${field}" must be an object or null`
    );
  }
}

function assertValidEventLogTypes(data: Record<string, unknown>): void {
  const value = data.eventLog;
  if (!Array.isArray(value)) return;
  for (let i = 0; i < value.length; i++) {
    const interaction = value[i];
    if (!isRecord(interaction)) {
      throw new Error(
        `Invalid serialized session: "eventLog[${i}]" must be an object`
      );
    }
    if (!isInteractionType(interaction.type)) {
      throw new Error(
        `Invalid serialized session: "eventLog[${i}].type" must be a valid interaction type`
      );
    }
  }
}

function validateSerializedSessionData(
  data: unknown
): asserts data is SerializedSessionData {
  if (!isRecord(data)) {
    throw new Error('Invalid serialized session: expected an object');
  }

  if (typeof data.sessionId !== 'string') {
    throw new Error('Invalid serialized session: "sessionId" must be a string');
  }

  if (typeof data.formatVersion !== 'number') {
    throw new Error(
      'Invalid serialized session: "formatVersion" must be a number'
    );
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

/**
 * Deserializes a serialized session payload into internal session state.
 *
 * Requires `formatVersion` and only supports the current serialized shape.
 *
 * @param data Serialized payload object.
 * @param clock Clock source for resumed runtime operations.
 * @param limits Optional caps for event log, pending intents, and checkpoints.
 * @returns Reconstructed internal session state.
 */
export function deserializeToState(
  data: unknown,
  clock: () => number,
  limits?: {
    maxEventLogSize?: number;
    maxPendingIntents?: number;
    maxCheckpoints?: number;
  }
): SessionState {
  validateSerializedSessionData(data);
  const raw = data;

  if (raw.formatVersion !== CURRENT_FORMAT_VERSION) {
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
      allowPriorDataWithoutPriorView:
        raw.settings?.allowPriorDataWithoutPriorView ??
        raw.settings?.allowBlindCarry,
      allowPartialRestore: raw.settings?.allowPartialRestore,
    },
    validateOnUpdate: raw.settings?.validateOnUpdate ?? false,
    restoreReviewsEnabled: raw.settings?.enableRestoreReviews ?? true,
    stableViewVersion:
      typeof raw.settings?.stableViewVersion === 'string'
        ? raw.settings.stableViewVersion
        : raw.currentView?.version ?? null,
    currentView: raw.currentView ?? null,
    currentData: sanitizeContinuumDataSnapshot(raw.currentData ?? null),
    priorView: raw.priorView ?? null,
    issues: raw.issues ?? [],
    diffs: raw.diffs ?? [],
    resolutions: raw.resolutions ?? [],
    eventLog: (raw.eventLog ?? []).slice(-(limits?.maxEventLogSize ?? 1000)),
    pendingIntents: (raw.pendingIntents ?? []).slice(
      -(limits?.maxPendingIntents ?? 500)
    ),
    checkpoints: sanitizeCheckpoints(
      (raw.checkpoints ?? []).slice(-(limits?.maxCheckpoints ?? 50))
    ),
    snapshotListeners: new Set(),
    streamListeners: new Set(),
    issueListeners: new Set(),
    focusedNodeId: null,
    focusListeners: new Set(),
    pendingProposals: {},
    actionRegistry: new Map(),
    streams: new Map(),
    activeForegroundStreamId: null,
    destroyed: false,
    approvedRestoreTargets: {},
    rejectedRestoreReviews: {},
  };
}
