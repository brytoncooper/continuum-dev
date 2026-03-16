import type {
  ContinuitySnapshot,
  DetachedValue,
  ViewportState,
  ViewDefinition,
  NodeValue,
} from '@continuum-dev/contract';
import type {
  ActionHandler,
  ActionRegistration,
  ActionResult,
  Checkpoint,
  DetachedRestoreReview,
  DetachedRestoreScope,
  Interaction,
  PendingIntent,
  ProposedValue,
  SessionStream,
  SessionStreamPart,
  SessionStreamResult,
  SessionStreamStartOptions,
  SessionViewApplyOptions,
} from '@continuum-dev/protocol';
export {
  INTERACTION_TYPES,
  INTENT_STATUS,
  isInteractionType,
  type ActionContext,
  type ActionHandler,
  type ActionRegistration,
  type ActionResult,
  type ActionSessionRef,
  type Checkpoint,
  type DetachedRestoreApproval,
  type DetachedRestoreReview,
  type DetachedRestoreReviewCandidate,
  type DetachedRestoreScope,
  type IntentStatus,
  type Interaction,
  type InteractionType,
  type PendingIntent,
  type ProposedValue,
  type SessionStream,
  type SessionStreamDiagnostics,
  type SessionStreamMode,
  type SessionStreamPart,
  type SessionStreamResult,
  type SessionStreamStartOptions,
  type SessionStreamStatus,
  type SessionStreamStatusLevel,
  type SessionViewApplyOptions,
} from '@continuum-dev/protocol';

import type {
  ReconciliationIssue,
  ReconciliationOptions,
  ReconciliationResolution,
  StateDiff,
} from '@continuum-dev/runtime';

/**
 * Optional limits for detached value retention.
 */
export interface DetachedValuePolicy {
  /**
   * Purge detached values older than this many milliseconds.
   */
  maxAge?: number;
  /**
   * Keep at most this many detached values, purging oldest first.
   */
  maxCount?: number;
  /**
   * Purge after this many pushView calls since detachment.
   */
  pushCount?: number;
}

/**
 * Minimal storage adapter used by session persistence.
 *
 * Compatible with browser `localStorage`/`sessionStorage` and custom storage engines.
 */
export interface SessionPersistenceStorage {
  /**
   * Returns the stored string for a key, or null when absent.
   */
  getItem(key: string): string | null;
  /**
   * Writes a string value for a key.
   */
  setItem(key: string, value: string): void;
  /**
   * Removes a key from storage.
   */
  removeItem(key: string): void;
}

/**
 * Configures automatic persistence and cross-tab synchronization.
 */
export interface SessionPersistenceOptions {
  /**
   * Backing storage implementation.
   */
  storage: SessionPersistenceStorage;
  /**
   * Storage key to write serialized session blobs under.
   *
   * Defaults to `continuum_session`.
   */
  key?: string;
  /**
   * Optional serialized payload byte limit.
   *
   * When exceeded, write is skipped and `onError` receives `size_limit`.
   */
  maxBytes?: number;
  /**
   * Optional callback for persistence failures.
   */
  onError?: (error: {
    reason: 'size_limit' | 'storage_error';
    key: string;
    attemptedBytes?: number;
    maxBytes?: number;
    cause?: unknown;
  }) => void;
}

/**
 * Creates and configures session runtime behavior.
 */
export interface SessionOptions {
  /**
   * Clock source used for ids and timestamps.
   *
   * Defaults to `Date.now`.
   */
  clock?: () => number;
  /**
   * Maximum number of interaction events to retain.
   */
  maxEventLogSize?: number;
  /**
   * Maximum number of pending intents to retain.
   */
  maxPendingIntents?: number;
  /**
   * Maximum number of checkpoints to retain.
   */
  maxCheckpoints?: number;
  /**
   * Reconciliation options forwarded to `@continuum-dev/runtime`.
   *
   * `clock` is managed by session and intentionally omitted here.
   */
  reconciliation?: Omit<ReconciliationOptions, 'clock'>;
  /**
   * When true, validates `updateState` payloads against node constraints.
   */
  validateOnUpdate?: boolean;
  /**
   * Enables automatic persistence to storage.
   */
  persistence?: SessionPersistenceOptions;
  /**
   * Detached value retention policy applied on view pushes.
   */
  detachedValuePolicy?: DetachedValuePolicy;
  /**
   * Initial action handlers to pre-register at session creation.
   */
  actions?: Record<
    string,
    { registration: ActionRegistration; handler: ActionHandler }
  >;
}

/**
 * Stateful session API for generative UI timelines.
 */
export interface Session {
  /**
   * Stable unique session identifier.
   */
  readonly sessionId: string;
  /**
   * True when session has been destroyed and no further operations are allowed.
   */
  readonly isDestroyed: boolean;
  /**
   * Returns the current combined view/data snapshot.
   */
  getSnapshot(): ContinuitySnapshot | null;
  /**
   * Returns the last durable committed view/data snapshot.
   */
  getCommittedSnapshot(): ContinuitySnapshot | null;
  /**
   * Returns reconciliation and validation issues collected so far.
   */
  getIssues(): ReconciliationIssue[];
  /**
   * Returns state diffs from the latest reconciliation.
   */
  getDiffs(): StateDiff[];
  /**
   * Returns per-node reconciliation decisions from the latest reconciliation.
   */
  getResolutions(): ReconciliationResolution[];
  /**
   * Pushes a new view and reconciles existing data against it.
   */
  pushView(view: ViewDefinition, options?: SessionViewApplyOptions): void;
  /**
   * Starts a new deterministic stream scoped to a target view id.
   */
  beginStream(options: SessionStreamStartOptions): SessionStream;
  /**
   * Applies a normalized stream part to an open stream.
   */
  applyStreamPart(streamId: string, part: SessionStreamPart): void;
  /**
   * Commits an open stream into durable session state.
   */
  commitStream(streamId: string): SessionStreamResult;
  /**
   * Aborts an open stream and drops its render overlay.
   */
  abortStream(streamId: string, reason?: string): SessionStreamResult;
  /**
   * Returns stream metadata for live and recently terminated streams.
   */
  getStreams(): SessionStream[];
  /**
   * Appends a raw interaction event to the event log and applies its payload.
   */
  recordIntent(
    interaction: Omit<
      Interaction,
      'interactionId' | 'timestamp' | 'sessionId' | 'viewVersion'
    >
  ): void;
  /**
   * Convenience wrapper for `data-update` interactions.
   */
  updateState(nodeId: string, payload: unknown): void;
  /**
   * Returns viewport metadata for a node, if present.
   */
  getViewportState(nodeId: string): ViewportState | undefined;
  /**
   * Updates viewport metadata and notifies snapshot listeners.
   */
  updateViewportState(nodeId: string, state: ViewportState): void;
  /**
   * Returns the interaction timeline.
   */
  getEventLog(): Interaction[];
  /**
   * Queues an intent awaiting validation/cancellation.
   */
  submitIntent(
    intent: Omit<
      PendingIntent,
      'intentId' | 'queuedAt' | 'status' | 'viewVersion'
    >
  ): void;
  /**
   * Returns currently tracked pending intents.
   */
  getPendingIntents(): PendingIntent[];
  /**
   * Returns detached values preserved across incompatible view changes.
   */
  getDetachedValues(): Record<string, DetachedValue>;
  /**
   * Purges detached values either fully or by predicate.
   */
  purgeDetachedValues(
    filter?: (key: string, value: DetachedValue) => boolean
  ): void;
  /**
   * Applies a value proposal immediately or stages it when current value is dirty.
   */
  proposeValue(nodeId: string, value: NodeValue, source?: string): void;
  /**
   * Accepts a staged proposal and applies it as a data update.
   */
  acceptProposal(nodeId: string): void;
  /**
   * Rejects and removes a staged proposal.
   */
  rejectProposal(nodeId: string): void;
  /**
   * Returns staged proposals keyed by node id.
   */
  getPendingProposals(): Record<string, ProposedValue>;
  /**
   * Marks a pending intent as validated.
   */
  validateIntent(intentId: string): boolean;
  /**
   * Marks a pending intent as cancelled.
   */
  cancelIntent(intentId: string): boolean;
  /**
   * Creates a manual checkpoint from current snapshot state.
   */
  checkpoint(): Checkpoint;
  /**
   * Restores view/data state from a specific checkpoint object.
   */
  restoreFromCheckpoint(checkpoint: Checkpoint): void;
  /**
   * Returns available checkpoints in chronological order.
   */
  getCheckpoints(): Checkpoint[];
  /**
   * Rewinds state to a checkpoint id and truncates checkpoint history after it.
   */
  rewind(checkpointId: string): void;
  /**
   * Clears active timeline state while preserving session id and configuration.
   */
  reset(): void;
  /**
   * Subscribes to snapshot updates.
   *
   * Returns an unsubscribe function.
   */
  onSnapshot(
    listener: (snapshot: ContinuitySnapshot | null) => void
  ): () => void;
  /**
   * Subscribes to stream metadata updates.
   *
   * Returns an unsubscribe function.
   */
  onStreams(listener: (streams: SessionStream[]) => void): () => void;
  /**
   * Subscribes to issue updates.
   *
   * Returns an unsubscribe function.
   */
  onIssues(listener: (issues: ReconciliationIssue[]) => void): () => void;
  /**
   * Serializes the complete session into a JSON-compatible blob.
   */
  serialize(): unknown;
  /**
   * Destroys the session and returns final issues observed before teardown.
   */
  destroy(): { issues: ReconciliationIssue[] };
  /**
   * Registers an action handler for an intent id.
   */
  registerAction(
    intentId: string,
    registration: ActionRegistration,
    handler: ActionHandler
  ): void;
  /**
   * Removes a previously registered action handler.
   */
  unregisterAction(intentId: string): void;
  /**
   * Returns action registration metadata for all registered actions.
   */
  getRegisteredActions(): Record<string, ActionRegistration>;
  /**
   * Dispatches a registered action handler with current snapshot context.
   *
   * Returns `{ success: false }` when no handler is registered or when no
   * active snapshot exists.
   */
  dispatchAction(intentId: string, nodeId: string): Promise<ActionResult>;
  /**
   * Submits a pending intent, dispatches the registered action, and updates
   * intent status based on the result (validated on success, cancelled on failure).
   *
   * Returns the same `ActionResult` shape as `dispatchAction`.
   */
  executeIntent(
    intent: Omit<
      PendingIntent,
      'intentId' | 'queuedAt' | 'status' | 'viewVersion'
    >
  ): Promise<ActionResult>;
  /**
   * Returns current pending restore reviews.
   */
  getPendingRestoreReviews(): DetachedRestoreReview[];
  /**
   * Accepts a fuzzy restore candidate for a detached key in a specific scope.
   */
  acceptRestoreCandidate(
    detachedKey: string,
    targetNodeId: string,
    scope: DetachedRestoreScope
  ): void;
  /**
   * Rejects a fuzzy restore review for a detached key in a specific scope.
   */
  rejectRestoreReview(detachedKey: string, scope: DetachedRestoreScope): void;
  /**
   * Clears all approved restore targets associated with a given scope.
   */
  clearApprovedRestoreTargetsForScope(scope: DetachedRestoreScope): void;
  /**
   * Updates state targeting either the live session or a draft stream.
   */
  updateStateInScope(
    nodeId: string,
    value: NodeValue,
    scope: DetachedRestoreScope
  ): void;
}

/**
 * Helper interface for dependency injection and test doubles.
 */
export interface SessionFactory {
  /**
   * Creates a fresh session.
   */
  createSession(options?: SessionOptions): Session;
  /**
   * Reconstructs a session from serialized data.
   */
  deserialize(data: unknown, options?: SessionOptions): Session;
}
