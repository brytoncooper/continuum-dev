import type { ContinuitySnapshot } from './snapshot.js';

export interface Interaction {
  id: string;
  sessionId: string;
  componentId: string;
  type: string;
  payload: unknown;
  timestamp: number;
  schemaVersion: string;
}

export interface PendingAction {
  id: string;
  componentId: string;
  actionType: string;
  payload: unknown;
  createdAt: number;
  schemaVersion: string;
  status: 'pending' | 'validated' | 'stale' | 'cancelled';
}

export interface Checkpoint {
  id: string;
  sessionId: string;
  snapshot: ContinuitySnapshot;
  eventIndex: number;
  timestamp: number;
}
