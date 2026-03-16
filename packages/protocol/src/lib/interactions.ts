import type { ContinuitySnapshot } from '@continuum-dev/contract';
import type { IntentStatus, InteractionType } from './constants.js';

/**
 * Immutable interaction event emitted by user or system activity.
 */
export interface Interaction {
  /**
   * Unique interaction identifier.
   */
  interactionId: string;
  /**
   * Session identifier for partitioning event streams.
   */
  sessionId: string;
  /**
   * Target node id.
   */
  nodeId: string;
  /**
   * Interaction category.
   */
  type: InteractionType;
  /**
   * Interaction-specific payload.
   */
  payload: unknown;
  /**
   * Event timestamp.
   */
  timestamp: number;
  /**
   * View version observed when the event occurred.
   */
  viewVersion: string;
}

/**
 * Queued intent awaiting validation/execution.
 */
export interface PendingIntent {
  /**
   * Unique intent instance identifier.
   */
  intentId: string;
  /**
   * Node id that originated the intent.
   */
  nodeId: string;
  /**
   * Intent name/category.
   */
  intentName: string;
  /**
   * Intent-specific payload.
   */
  payload: unknown;
  /**
   * Queue timestamp.
   */
  queuedAt: number;
  /**
   * View version at queue time.
   */
  viewVersion: string;
  /**
   * Current intent lifecycle status.
   */
  status: IntentStatus;
}

/**
 * Durable restore point in a session timeline.
 */
export interface Checkpoint {
  /**
   * Unique checkpoint identifier.
   */
  checkpointId: string;
  /**
   * Session identifier for this checkpoint.
   */
  sessionId: string;
  /**
   * Full continuity snapshot captured at this checkpoint.
   */
  snapshot: ContinuitySnapshot;
  /**
   * Event stream index associated with this snapshot.
   */
  eventIndex: number;
  /**
   * Checkpoint creation timestamp.
   */
  timestamp: number;
  /**
   * Origin of checkpoint creation.
   */
  trigger: 'auto' | 'manual';
}
