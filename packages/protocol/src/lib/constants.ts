/**
 * Canonical issue taxonomy for reconciliation, validation, and view analysis.
 */
export const ISSUE_CODES = {
  NO_PRIOR_DATA: 'NO_PRIOR_DATA',
  NO_PRIOR_VIEW: 'NO_PRIOR_VIEW',
  TYPE_MISMATCH: 'TYPE_MISMATCH',
  NODE_REMOVED: 'NODE_REMOVED',
  MIGRATION_FAILED: 'MIGRATION_FAILED',
  UNVALIDATED_CARRY: 'UNVALIDATED_CARRY',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNKNOWN_NODE: 'UNKNOWN_NODE',
  DUPLICATE_NODE_ID: 'DUPLICATE_NODE_ID',
  DUPLICATE_NODE_KEY: 'DUPLICATE_NODE_KEY',
  VIEW_CHILD_CYCLE_DETECTED: 'VIEW_CHILD_CYCLE_DETECTED',
  VIEW_MAX_DEPTH_EXCEEDED: 'VIEW_MAX_DEPTH_EXCEEDED',
  COLLECTION_CONSTRAINT_VIOLATED: 'COLLECTION_CONSTRAINT_VIOLATED',
  SCOPE_COLLISION: 'SCOPE_COLLISION',
  SEMANTIC_KEY_MISSING_STATEFUL: 'SEMANTIC_KEY_MISSING_STATEFUL',
  SEMANTIC_KEY_CHURN: 'SEMANTIC_KEY_CHURN',
  VIEW_REPLACEMENT_RATIO_HIGH: 'VIEW_REPLACEMENT_RATIO_HIGH',
  DETACHED_FIELD_GROWTH: 'DETACHED_FIELD_GROWTH',
  CONTINUITY_LOSS: 'CONTINUITY_LOSS',
  ORPHANED_ACTION_INTENT: 'ORPHANED_ACTION_INTENT',
  LAYOUT_DEPTH_EXPLOSION: 'LAYOUT_DEPTH_EXPLOSION',
  COLLECTION_TEMPLATE_INVALID: 'COLLECTION_TEMPLATE_INVALID',
} as const;

/**
 * Union of all supported issue code literals.
 */
export type IssueCode = (typeof ISSUE_CODES)[keyof typeof ISSUE_CODES];

/**
 * Outcomes for how a value was handled during reconciliation.
 */
export const DATA_RESOLUTIONS = {
  CARRIED: 'carried',
  MIGRATED: 'migrated',
  DETACHED: 'detached',
  ADDED: 'added',
  RESTORED: 'restored',
} as const;

/**
 * Union of all supported data resolution literals.
 */
export type DataResolution =
  (typeof DATA_RESOLUTIONS)[keyof typeof DATA_RESOLUTIONS];

/**
 * Node-level structural change classifications between view revisions.
 */
export const VIEW_DIFFS = {
  ADDED: 'added',
  REMOVED: 'removed',
  MIGRATED: 'migrated',
  TYPE_CHANGED: 'type-changed',
  RESTORED: 'restored',
} as const;

/**
 * Union of all supported view diff literals.
 */
export type ViewDiff = (typeof VIEW_DIFFS)[keyof typeof VIEW_DIFFS];

/**
 * Severity levels for reported issues.
 */
export const ISSUE_SEVERITY = {
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
} as const;

/**
 * Union of all supported issue severity literals.
 */
export type IssueSeverity =
  (typeof ISSUE_SEVERITY)[keyof typeof ISSUE_SEVERITY];

/**
 * Canonical interaction categories for event producers/consumers.
 */
export const INTERACTION_TYPES = {
  DATA_UPDATE: 'data-update',
  VALUE_CHANGE: 'value-change',
  VIEW_CONTEXT_CHANGE: 'view-context-change',
  VALUE_REVIEW: 'value-review',
  VALUE_LOCK: 'value-lock',
  VALUE_UNLOCK: 'value-unlock',
  VALUE_SUBMIT: 'value-submit',
} as const;

/**
 * Union of all supported interaction type literals.
 */
export type InteractionType =
  (typeof INTERACTION_TYPES)[keyof typeof INTERACTION_TYPES];

const INTERACTION_TYPE_VALUES: ReadonlySet<string> = new Set(
  Object.values(INTERACTION_TYPES)
);

/**
 * Runtime type guard for {@link InteractionType}.
 */
export function isInteractionType(value: unknown): value is InteractionType {
  return typeof value === 'string' && INTERACTION_TYPE_VALUES.has(value);
}

/**
 * Lifecycle states for queued intents.
 */
export const INTENT_STATUS = {
  PENDING: 'pending',
  VALIDATED: 'validated',
  STALE: 'stale',
  CANCELLED: 'cancelled',
} as const;

/**
 * Union of all supported intent status literals.
 */
export type IntentStatus = (typeof INTENT_STATUS)[keyof typeof INTENT_STATUS];
