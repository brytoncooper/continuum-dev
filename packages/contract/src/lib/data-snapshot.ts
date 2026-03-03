export interface DataSnapshot {
  values: Record<string, NodeValue>;
  viewContext?: Record<string, ViewportState>;
  lineage: SnapshotLineage;
  valueLineage?: Record<string, ValueLineage>;
  detachedValues?: Record<string, DetachedValue>;
}

export interface NodeValue<T = unknown> {
  value: T;
  suggestion?: T;
  isDirty?: boolean;
  isValid?: boolean;
}

export interface CollectionItemState {
  values: Record<string, NodeValue>;
}

export interface CollectionNodeState {
  items: CollectionItemState[];
}

export interface ViewportState {
  scrollX?: number;
  scrollY?: number;
  zoom?: number;
  offsetX?: number;
  offsetY?: number;
  isExpanded?: boolean;
  isFocused?: boolean;
}

export type ViewContext = ViewportState;

export interface SnapshotLineage {
  timestamp: number;
  sessionId: string;
  viewId?: string;
  viewVersion?: string;
  viewHash?: string;
  lastInteractionId?: string;
}

export interface ValueLineage {
  lastUpdated?: number;
  lastInteractionId?: string;
}

export interface DetachedValue {
  value: unknown;
  previousNodeType: string;
  key?: string;
  detachedAt: number;
  viewVersion: string;
  reason: 'node-removed' | 'type-mismatch' | 'migration-failed';
  pushesSinceDetach?: number;
}

export interface DetachedValuePolicy {
  /** Purge detached values older than this many milliseconds */
  maxAge?: number;
  /** Keep at most this many detached values (oldest purged first) */
  maxCount?: number;
  /** Purge after this many pushView calls since detachment */
  pushCount?: number;
}

export interface ProposedValue {
  nodeId: string;
  proposedValue: NodeValue;
  currentValue: NodeValue;
  proposedAt: number;
  source?: string;
}

export interface ActionRegistration {
  label: string;
  description?: string;
  icon?: string;
}

export interface ActionContext {
  intentId: string;
  snapshot: DataSnapshot;
  nodeId: string;
}

export type ActionHandler = (context: ActionContext) => void | Promise<void>;

