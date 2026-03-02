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
  COLLECTION_CONSTRAINT_VIOLATED: 'COLLECTION_CONSTRAINT_VIOLATED',
  SCOPE_COLLISION: 'SCOPE_COLLISION',
} as const;

export type IssueCode = (typeof ISSUE_CODES)[keyof typeof ISSUE_CODES];

export const DATA_RESOLUTIONS = {
  CARRIED: 'carried',
  MIGRATED: 'migrated',
  DETACHED: 'detached',
  ADDED: 'added',
  RESTORED: 'restored',
} as const;

export type DataResolution = (typeof DATA_RESOLUTIONS)[keyof typeof DATA_RESOLUTIONS];

export const VIEW_DIFFS = {
  ADDED: 'added',
  REMOVED: 'removed',
  MIGRATED: 'migrated',
  TYPE_CHANGED: 'type-changed',
  RESTORED: 'restored',
} as const;

export type ViewDiff = (typeof VIEW_DIFFS)[keyof typeof VIEW_DIFFS];

export const ISSUE_SEVERITY = {
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
} as const;

export type IssueSeverity = (typeof ISSUE_SEVERITY)[keyof typeof ISSUE_SEVERITY];

export const INTERACTION_TYPES = {
  DATA_UPDATE: 'data-update',
  VALUE_CHANGE: 'value-change',
  VIEW_CONTEXT_CHANGE: 'view-context-change',
} as const;

export type InteractionType = (typeof INTERACTION_TYPES)[keyof typeof INTERACTION_TYPES];

const INTERACTION_TYPE_VALUES: ReadonlySet<string> = new Set(Object.values(INTERACTION_TYPES));

export function isInteractionType(value: unknown): value is InteractionType {
  return typeof value === 'string' && INTERACTION_TYPE_VALUES.has(value);
}

export const INTENT_STATUS = {
  PENDING: 'pending',
  VALIDATED: 'validated',
  STALE: 'stale',
  CANCELLED: 'cancelled',
} as const;

export type IntentStatus = (typeof INTENT_STATUS)[keyof typeof INTENT_STATUS];
