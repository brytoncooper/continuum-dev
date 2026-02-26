import type { ContinuitySnapshot } from './snapshot.js';
import type { ActionStatus } from './constants.js';

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
  status: ActionStatus;
}

export interface Checkpoint {
  id: string;
  sessionId: string;
  snapshot: ContinuitySnapshot;
  eventIndex: number;
  timestamp: number;
}
