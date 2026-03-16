import type {
  ContinuitySnapshot,
  DataSnapshot,
  NodeValue,
  ViewDefinition,
} from '@continuum-dev/contract';

/**
 * Display metadata for a registered action intent.
 */
export interface ActionRegistration {
  /**
   * Human-readable action label.
   */
  label: string;
  /**
   * Optional helper text for the action.
   */
  description?: string;
  /**
   * Optional icon token/name for rendering.
   */
  icon?: string;
}

/**
 * Standardized outcome payload returned by action handlers.
 *
 * @template T Optional data payload type returned on success.
 */
export interface ActionResult<T = unknown> {
  /**
   * True when the action completed successfully.
   */
  success: boolean;
  /**
   * Optional successful result payload.
   */
  data?: T;
  /**
   * Optional error payload when `success` is false.
   */
  error?: unknown;
}

/**
 * Narrow session capability surface exposed to action handlers.
 */
export interface ActionSessionRef {
  /**
   * Pushes a new view and triggers reconciliation.
   */
  pushView(view: ViewDefinition): void;
  /**
   * Applies a data update for a node.
   */
  updateState(nodeId: string, payload: unknown): void;
  /**
   * Returns the active continuity snapshot when available.
   */
  getSnapshot(): ContinuitySnapshot | null;
  /**
   * Proposes a value, preserving user edits when conflicts exist.
   */
  proposeValue(nodeId: string, value: NodeValue, source?: string): void;
}

/**
 * Invocation context provided to action handlers.
 */
export interface ActionContext {
  /**
   * Registered intent id being dispatched.
   */
  intentId: string;
  /**
   * Current data snapshot at dispatch time.
   */
  snapshot: DataSnapshot;
  /**
   * Node id that triggered the action.
   */
  nodeId: string;
  /**
   * Session reference for safe runtime mutations.
   */
  session: ActionSessionRef;
}

/**
 * Action handler signature.
 *
 * Handlers may return an `ActionResult` (sync/async) or return nothing.
 */
export type ActionHandler = (
  context: ActionContext
) => ActionResult | Promise<ActionResult> | void | Promise<void>;
