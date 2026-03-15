import { ISSUE_CODES, ISSUE_SEVERITY } from '@continuum-dev/contract';
import type { ReconciliationIssue } from '../types.js';
import type { ValidationIssueInput } from './types.js';

export function validationFailedIssue({
  nodeId,
  message,
}: ValidationIssueInput): ReconciliationIssue {
  return {
    severity: ISSUE_SEVERITY.WARNING,
    nodeId,
    message,
    code: ISSUE_CODES.VALIDATION_FAILED,
  };
}
