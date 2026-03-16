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
   * True if this value should be protected from silent AI overwrites.
   */
  isSticky?: boolean;
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
   * Optional explicit semantic identity used for deterministic restoration.
   */
  semanticKey?: string;
  /**
   * Optional semantic key used to match and restore this value later.
   */
  key?: string;
  /**
   * Prior user-facing label, if one existed.
   */
  previousLabel?: string;
  /**
   * Prior immediate parent label, if one existed.
   */
  previousParentLabel?: string;
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

