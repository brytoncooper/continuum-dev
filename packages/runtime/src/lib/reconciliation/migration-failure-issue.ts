import { ISSUE_CODES, ISSUE_SEVERITY } from '@continuum-dev/contract';
import type { ReconciliationIssue } from '../types.js';
import type { MigrationAttemptResult } from './migrator/index.js';

export function createMigrationFailureIssue(
  nodeId: string,
  result: Extract<MigrationAttemptResult, { kind: 'none' | 'error' }>
): ReconciliationIssue {
  return {
    severity: ISSUE_SEVERITY.WARNING,
    nodeId,
    message:
      result.kind === 'error'
        ? `Node ${nodeId} migration failed: ${String(result.error)}`
        : `Node ${nodeId} view changed but no migration strategy available`,
    code: ISSUE_CODES.MIGRATION_FAILED,
  };
}
