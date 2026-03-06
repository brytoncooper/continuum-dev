import type {
  ContinuitySnapshot,
  Interaction,
  DetachedValue,
  DetachedValuePolicy,
  ProposedValue,
  ViewportState,
  PendingIntent,
  Checkpoint,
  ViewDefinition,
  NodeValue,
  ActionRegistration,
  ActionHandler,
} from '@continuum/contract';
import type {
  ReconciliationIssue,
  ReconciliationOptions,
  ReconciliationResolution,
  StateDiff,
} from '@continuum/runtime';

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
   * Reconciliation options forwarded to `@continuum/runtime`.
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
  actions?: Record<string, { registration: ActionRegistration; handler: ActionHandler }>;
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
  pushView(view: ViewDefinition): void;
  /**
   * Appends a raw interaction event to the event log and applies its payload.
   */
  recordIntent(interaction: Omit<Interaction, 'interactionId' | 'timestamp' | 'sessionId' | 'viewVersion'>): void;
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
  submitIntent(intent: Omit<PendingIntent, 'intentId' | 'queuedAt' | 'status' | 'viewVersion'>): void;
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
  purgeDetachedValues(filter?: (key: string, value: DetachedValue) => boolean): void;
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
  onSnapshot(listener: (snapshot: ContinuitySnapshot | null) => void): () => void;
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
  registerAction(intentId: string, registration: ActionRegistration, handler: ActionHandler): void;
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
   */
  dispatchAction(intentId: string, nodeId: string): void | Promise<void>;
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
