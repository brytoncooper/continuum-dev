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

export interface SessionPersistenceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface SessionPersistenceOptions {
  storage: SessionPersistenceStorage;
  key?: string;
  maxBytes?: number;
  onError?: (error: {
    reason: 'size_limit' | 'storage_error';
    key: string;
    attemptedBytes?: number;
    maxBytes?: number;
    cause?: unknown;
  }) => void;
}

export interface SessionOptions {
  clock?: () => number;
  maxEventLogSize?: number;
  maxPendingIntents?: number;
  maxCheckpoints?: number;
  reconciliation?: Omit<ReconciliationOptions, 'clock'>;
  validateOnUpdate?: boolean;
  persistence?: SessionPersistenceOptions;
  detachedValuePolicy?: DetachedValuePolicy;
  actions?: Record<string, { registration: ActionRegistration; handler: ActionHandler }>;
}

export interface Session {
  readonly sessionId: string;
  readonly isDestroyed: boolean;
  getSnapshot(): ContinuitySnapshot | null;
  getIssues(): ReconciliationIssue[];
  getDiffs(): StateDiff[];
  getResolutions(): ReconciliationResolution[];
  pushView(view: ViewDefinition): void;
  recordIntent(interaction: Omit<Interaction, 'interactionId' | 'timestamp' | 'sessionId' | 'viewVersion'>): void;
  updateState(nodeId: string, payload: unknown): void;
  getViewportState(nodeId: string): ViewportState | undefined;
  updateViewportState(nodeId: string, state: ViewportState): void;
  getEventLog(): Interaction[];
  submitIntent(intent: Omit<PendingIntent, 'intentId' | 'queuedAt' | 'status' | 'viewVersion'>): void;
  getPendingIntents(): PendingIntent[];
  getDetachedValues(): Record<string, DetachedValue>;
  purgeDetachedValues(filter?: (key: string, value: DetachedValue) => boolean): void;
  proposeValue(nodeId: string, value: NodeValue, source?: string): void;
  acceptProposal(nodeId: string): void;
  rejectProposal(nodeId: string): void;
  getPendingProposals(): Record<string, ProposedValue>;
  validateIntent(intentId: string): boolean;
  cancelIntent(intentId: string): boolean;
  checkpoint(): Checkpoint;
  restoreFromCheckpoint(checkpoint: Checkpoint): void;
  getCheckpoints(): Checkpoint[];
  rewind(checkpointId: string): void;
  reset(): void;
  onSnapshot(listener: (snapshot: ContinuitySnapshot | null) => void): () => void;
  onIssues(listener: (issues: ReconciliationIssue[]) => void): () => void;
  serialize(): unknown;
  destroy(): { issues: ReconciliationIssue[] };
  registerAction(intentId: string, registration: ActionRegistration, handler: ActionHandler): void;
  unregisterAction(intentId: string): void;
  getRegisteredActions(): Record<string, ActionRegistration>;
  dispatchAction(intentId: string, nodeId: string): void | Promise<void>;
}

export interface SessionFactory {
  createSession(options?: SessionOptions): Session;
  deserialize(data: unknown, options?: SessionOptions): Session;
}
