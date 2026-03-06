/**
 * The complete user-owned state of the UI at a specific point in time.
 * This is kept strictly separate from the ViewDefinition to ensure data survives UI restructures.
 */
export interface DataSnapshot {
  /**
   * Active values keyed by node id.
   */
  values: Record<string, NodeValue>;
  /**
   * Per-node UI state keyed by node id.
   */
  viewContext?: Record<string, ViewportState>;
  /**
   * Provenance for the snapshot as a whole.
   */
  lineage: SnapshotLineage;
  /**
   * Optional per-value provenance keyed by node id.
   */
  valueLineage?: Record<string, ValueLineage>;
  /**
   * Values preserved when no longer safely mappable to active nodes.
   */
  detachedValues?: Record<string, DetachedValue>;
}

/**
 * Wraps a node's data payload with collaboration and validation metadata.
 * Designed to safely merge AI suggestions without overwriting dirty user state.
 *
 * @template T The underlying data type.
 */
export interface NodeValue<T = unknown> {
  /**
   * The current, actual value of the node.
   */
  value: T;
  /**
   * An AI-proposed alternative value awaiting user approval.
   */
  suggestion?: T;
  /**
   * True if the user has manually edited this value.
   */
  isDirty?: boolean;
  /**
   * True if the value currently passes the ViewDefinition's constraints.
   */
  isValid?: boolean;
}

/**
 * Data state for one collection item.
 */
export interface CollectionItemState {
  /**
   * Item field values keyed by node id.
   */
  values: Record<string, NodeValue>;
}

/**
 * Data state for a collection node.
 */
export interface CollectionNodeState {
  /**
   * Ordered collection item states.
   */
  items: CollectionItemState[];
}

/**
 * Ephemeral viewport and interaction state for a node.
 */
export interface ViewportState {
  /**
   * Horizontal scroll position.
   */
  scrollX?: number;
  /**
   * Vertical scroll position.
   */
  scrollY?: number;
  /**
   * Zoom factor applied to the viewport.
   */
  zoom?: number;
  /**
   * Horizontal pan offset.
   */
  offsetX?: number;
  /**
   * Vertical pan offset.
   */
  offsetY?: number;
  /**
   * Whether the associated UI region is expanded.
   */
  isExpanded?: boolean;
  /**
   * Whether the associated UI region currently has focus.
   */
  isFocused?: boolean;
}

/**
 * Backward-compatible alias for viewport context.
 */
export type ViewContext = ViewportState;

/**
 * Global provenance metadata for a data snapshot.
 */
export interface SnapshotLineage {
  /**
   * Snapshot creation/update timestamp.
   */
  timestamp: number;
  /**
   * Owning session identifier.
   */
  sessionId: string;
  /**
   * Logical view identity.
   */
  viewId?: string;
  /**
   * View version associated with this snapshot.
   */
  viewVersion?: string;
  /**
   * Optional structural hash of the view.
   */
  viewHash?: string;
  /**
   * Interaction that most recently mutated the snapshot.
   */
  lastInteractionId?: string;
}

/**
 * Provenance metadata for a single value key.
 */
export interface ValueLineage {
  /**
   * Last update timestamp for this value.
   */
  lastUpdated?: number;
  /**
   * Interaction that last updated this value.
   */
  lastInteractionId?: string;
}

/**
 * Preserves user data from nodes that were removed or changed incompatibly.
 * If the node returns in a compatible shape, this value can be restored.
 */
export interface DetachedValue {
  /**
   * The preserved user data.
   */
  value: unknown;
  /**
   * Node type where this value originated.
   */
  previousNodeType: string;
  /**
   * Optional semantic key used to match and restore this value later.
   */
  key?: string;
  /**
   * Detachment timestamp.
   */
  detachedAt: number;
  /**
   * View version at detachment time.
   */
  viewVersion: string;
  /**
   * Why this value was detached.
   */
  reason: 'node-removed' | 'type-mismatch' | 'migration-failed';
  /**
   * Number of pushView cycles since detachment.
   */
  pushesSinceDetach?: number;
}

/**
 * Optional limits for detached value retention.
 */
export interface DetachedValuePolicy {
  /**
   * Purge detached values older than this many milliseconds.
   */
  maxAge?: number;
  /**
   * Keep at most this many detached values, purging oldest first.
   */
  maxCount?: number;
  /**
   * Purge after this many pushView calls since detachment.
   */
  pushCount?: number;
}

/**
 * Models an AI-suggested value alongside the current user value.
 * Used by conflict-resolution and diff-based approval flows.
 */
export interface ProposedValue {
  /**
   * Target node id.
   */
  nodeId: string;
  /**
   * Proposed replacement value.
   */
  proposedValue: NodeValue;
  /**
   * Current active value.
   */
  currentValue: NodeValue;
  /**
   * Proposal timestamp.
   */
  proposedAt: number;
  /**
   * Optional proposal source identifier.
   */
  source?: string;
}

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
  pushView(view: import('./view-definition.js').ViewDefinition): void;
  /**
   * Applies a data update for a node.
   */
  updateState(nodeId: string, payload: unknown): void;
  /**
   * Returns the active continuity snapshot when available.
   */
  getSnapshot(): import('./continuity-snapshot.js').ContinuitySnapshot | null;
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
export type ActionHandler = (context: ActionContext) => ActionResult | Promise<ActionResult> | void | Promise<void>;

