import type {
  ContinuitySnapshot,
  Interaction,
  DetachedValue,
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

export interface SessionOptions {
  clock?: () => number;
  maxEventLogSize?: number;
  maxPendingIntents?: number;
  maxCheckpoints?: number;
  reconciliation?: Omit<ReconciliationOptions, 'clock'>;
  validateOnUpdate?: boolean;
}

export interface Session {
  readonly sessionId: string;
  getSnapshot(): ContinuitySnapshot | null;
  getIssues(): ReconciliationIssue[];
  getDiffs(): StateDiff[];
  getResolutions(): ReconciliationResolution[];
  pushView(view: ViewDefinition): void;
  recordIntent(interaction: Omit<Interaction, 'interactionId' | 'timestamp' | 'sessionId' | 'viewVersion'>): void;
  updateState(nodeId: string, payload: unknown): void;
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
