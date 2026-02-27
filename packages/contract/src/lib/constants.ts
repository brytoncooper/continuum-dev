export const ISSUE_CODES = {
  NO_PRIOR_STATE: 'NO_PRIOR_STATE',
  NO_PRIOR_SCHEMA: 'NO_PRIOR_SCHEMA',
  TYPE_MISMATCH: 'TYPE_MISMATCH',
  COMPONENT_REMOVED: 'COMPONENT_REMOVED',
  MIGRATION_FAILED: 'MIGRATION_FAILED',
  UNTRUSTED_CARRY: 'UNTRUSTED_CARRY',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNKNOWN_COMPONENT: 'UNKNOWN_COMPONENT',
} as const;

export type IssueCode = (typeof ISSUE_CODES)[keyof typeof ISSUE_CODES];

export const TRACE_ACTIONS = {
  CARRIED: 'carried',
  MIGRATED: 'migrated',
  DROPPED: 'dropped',
  ADDED: 'added',
  RESTORED: 'restored',
} as const;

export type TraceAction = (typeof TRACE_ACTIONS)[keyof typeof TRACE_ACTIONS];

export const DIFF_TYPES = {
  ADDED: 'added',
  REMOVED: 'removed',
  MIGRATED: 'migrated',
  TYPE_CHANGED: 'type-changed',
  RESTORED: 'restored',
} as const;

export type DiffType = (typeof DIFF_TYPES)[keyof typeof DIFF_TYPES];

export const ISSUE_SEVERITY = {
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
} as const;

export type IssueSeverity = (typeof ISSUE_SEVERITY)[keyof typeof ISSUE_SEVERITY];

export const INTERACTION_TYPES = {
  STATE_UPDATE: 'state-update',
  VALUE_CHANGE: 'value-change',
} as const;

export type InteractionType = (typeof INTERACTION_TYPES)[keyof typeof INTERACTION_TYPES];

export const ACTION_STATUS = {
  PENDING: 'pending',
  VALIDATED: 'validated',
  STALE: 'stale',
  CANCELLED: 'cancelled',
} as const;

export type ActionStatus = (typeof ACTION_STATUS)[keyof typeof ACTION_STATUS];
