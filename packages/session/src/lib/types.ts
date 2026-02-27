import type {
  ContinuitySnapshot,
  Interaction,
  OrphanedValue,
  PendingAction,
  Checkpoint,
  SchemaSnapshot,
} from '@continuum/contract';
import type {
  ReconciliationIssue,
  ReconciliationOptions,
  ReconciliationTrace,
  StateDiff,
} from '@continuum/runtime';

export interface SessionOptions {
  clock?: () => number;
  maxEventLogSize?: number;
  maxPendingActions?: number;
  maxCheckpoints?: number;
  reconciliation?: Omit<ReconciliationOptions, 'clock'>;
  validateOnUpdate?: boolean;
}

export interface Session {
  readonly sessionId: string;
  getSnapshot(): ContinuitySnapshot | null;
  getIssues(): ReconciliationIssue[];
  getDiffs(): StateDiff[];
  getTrace(): ReconciliationTrace[];
  pushSchema(schema: SchemaSnapshot): void;
  recordIntent(interaction: Omit<Interaction, 'id' | 'timestamp' | 'sessionId' | 'schemaVersion'>): void;
  updateState(componentId: string, payload: unknown): void;
  getEventLog(): Interaction[];
  submitAction(action: Omit<PendingAction, 'id' | 'createdAt' | 'status' | 'schemaVersion'>): void;
  getPendingActions(): PendingAction[];
  getOrphanedValues(): Record<string, OrphanedValue>;
  validateAction(actionId: string): boolean;
  cancelAction(actionId: string): boolean;
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
