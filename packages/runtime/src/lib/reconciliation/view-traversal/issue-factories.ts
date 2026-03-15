import { ISSUE_CODES, ISSUE_SEVERITY } from '@continuum-dev/contract';
import type { ReconciliationIssue } from '../../types.js';

interface DepthExceededIssueInput {
  nodeId: string;
  maxDepth: number;
}

interface CycleDetectedIssueInput {
  nodeId: string;
  nodeRawId: string;
}

export function depthExceededIssue(
  input: DepthExceededIssueInput
): ReconciliationIssue {
  return {
    severity: ISSUE_SEVERITY.ERROR,
    nodeId: input.nodeId,
    message: `View node depth exceeds max depth of ${input.maxDepth}`,
    code: ISSUE_CODES.VIEW_MAX_DEPTH_EXCEEDED,
  };
}

export function cycleDetectedIssue(
  input: CycleDetectedIssueInput
): ReconciliationIssue {
  return {
    severity: ISSUE_SEVERITY.ERROR,
    nodeId: input.nodeId,
    message: `Cycle detected while traversing children for node ${input.nodeRawId}`,
    code: ISSUE_CODES.VIEW_CHILD_CYCLE_DETECTED,
  };
}
