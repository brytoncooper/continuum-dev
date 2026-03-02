import type {
  ContinuitySnapshot,
  Interaction,
  DetachedValue,
  ViewportState,
  PendingIntent,
  Checkpoint,
  ViewDefinition,
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
  validateIntent(intentId: string): boolean;
  cancelIntent(intentId: string): boolean;
  checkpoint(): Checkpoint;
  restoreFromCheckpoint(checkpoint: Checkpoint): void;
  getCheckpoints(): Checkpoint[];
  rewind(checkpointId: string): void;
  reset(): void;
  onSnapshot(listener: (snapshot: ContinuitySnapshot) => void): () => void;
  onIssues(listener: (issues: ReconciliationIssue[]) => void): () => void;
  serialize(): unknown;
  destroy(): { issues: ReconciliationIssue[] };
}

export interface SessionFactory {
  createSession(options?: SessionOptions): Session;
  deserialize(data: unknown, options?: SessionOptions): Session;
}
