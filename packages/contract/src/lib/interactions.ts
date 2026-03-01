import type { ContinuitySnapshot } from './continuity-snapshot.js';
import type { IntentStatus } from './constants.js';

export interface Interaction {
  interactionId: string;
  sessionId: string;
  nodeId: string;
  type: string;
  payload: unknown;
  timestamp: number;
  viewVersion: string;
}

export interface PendingIntent {
  intentId: string;
  nodeId: string;
  intentName: string;
  payload: unknown;
  queuedAt: number;
  viewVersion: string;
  status: IntentStatus;
}

export interface Checkpoint {
  checkpointId: string;
  sessionId: string;
  snapshot: ContinuitySnapshot;
  eventIndex: number;
  timestamp: number;
  trigger: 'auto' | 'manual';
}
