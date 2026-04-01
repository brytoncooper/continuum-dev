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

export type ValueProtectionOwner = 'ai' | 'user';

export type ValueProtectionStage =
  | 'flexible'
  | 'reviewed'
  | 'locked'
  | 'submitted';

/**
 * Explicit ownership and overwrite policy for one semantic value.
 */
export interface ValueProtection {
  /**
   * The actor who currently owns this value's protection policy.
   */
  owner: ValueProtectionOwner;
  /**
   * The current hardening stage for this value.
   */
  stage: ValueProtectionStage;
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
   * Explicit owner/stage metadata for non-dirty value protection.
   */
  protection?: ValueProtection;
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

export function isCollectionNodeState(
  value: unknown
): value is CollectionNodeState {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as { items?: unknown };
  return Array.isArray(candidate.items);
}

/**
 * Returns true when the current value must not be silently overwritten.
 */
export function isProtectedNodeValue(
  value:
    | {
        isDirty?: boolean;
        protection?: ValueProtection;
      }
    | null
    | undefined
): boolean {
  if (!value) {
    return false;
  }

  if (value.isDirty === true) {
    return true;
  }

  const stage = value.protection?.stage;
  return (
    stage === 'reviewed' || stage === 'locked' || stage === 'submitted'
  );
}

/**
 * Maps nested collection item values while preserving other collection shape.
 */
export function mapNestedCollectionValues(
  value: unknown,
  mapper: (value: NodeValue, currentValue?: NodeValue) => NodeValue,
  currentValue?: unknown
): unknown {
  if (!isCollectionNodeState(value)) {
    return value;
  }

  const currentItems = isCollectionNodeState(currentValue)
    ? currentValue.items
    : [];

  return {
    items: value.items.map((item, itemIndex) => {
      const nextValues: Record<string, NodeValue> = {};
      const values = item?.values ?? {};
      const currentItemValues = currentItems[itemIndex]?.values ?? {};

      for (const [nodeId, nodeValue] of Object.entries(values)) {
        nextValues[nodeId] = mapper(nodeValue, currentItemValues[nodeId]);
      }

      return {
        values: nextValues,
      };
    }),
  } satisfies CollectionNodeState;
}

function cloneProtection(
  protection: ValueProtection | undefined
): ValueProtection | undefined {
  return protection ? { ...protection } : undefined;
}

/**
 * Normalizes a node value so protection metadata is explicit and consistent.
 */
export function normalizeNodeValueProtection(
  value: NodeValue,
  currentValue?: NodeValue
): NodeValue {
  const normalized = structuredClone(value) as NodeValue;
  normalized.value = mapNestedCollectionValues(
    normalized.value,
    (nestedValue, currentNestedValue) =>
      normalizeNodeValueProtection(nestedValue, currentNestedValue),
    currentValue?.value
  );

  if (normalized.isDirty === true) {
    const preservedStage = currentValue?.protection?.stage;
    normalized.protection = {
      owner: 'user',
      stage:
        preservedStage === 'locked' || preservedStage === 'submitted'
          ? preservedStage
          : 'flexible',
    };
    return normalized;
  }

  if (normalized.protection) {
    normalized.protection = cloneProtection(normalized.protection);
    return normalized;
  }

  normalized.protection = {
    owner: 'ai',
    stage: 'flexible',
  };
  return normalized;
}

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
