import type {
  ContinuitySnapshot,
  Interaction,
  PendingAction,
  Checkpoint,
  SchemaSnapshot,
} from '@continuum/contract';
import type { ReconciliationIssue, ReconciliationTrace, StateDiff } from '@continuum/runtime';

export interface SessionOptions {
  clock?: () => number;
  maxEventLogSize?: number;
  maxPendingActions?: number;
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
