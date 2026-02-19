import type {
  ContinuitySnapshot,
  Interaction,
  PendingAction,
  Checkpoint,
  SchemaSnapshot,
  StateSnapshot,
} from '@continuum/contract';
import type { ReconciliationIssue, ReconciliationTrace, StateDiff } from '@continuum/runtime';

export interface SessionOptions {
  clock?: () => number;
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
  validateAction(actionId: string): void;
  cancelAction(actionId: string): void;
  checkpoint(): Checkpoint;
  restoreFromCheckpoint(checkpoint: Checkpoint): void;
  onSnapshot(listener: (snapshot: ContinuitySnapshot) => void): () => void;
  onIssues(listener: (issues: ReconciliationIssue[]) => void): () => void;
  serialize(): unknown;
  destroy(): { issues: ReconciliationIssue[] };
}

export interface SessionFactory {
  createSession(options?: SessionOptions): Session;
  deserialize(data: unknown, options?: SessionOptions): Session;
}
