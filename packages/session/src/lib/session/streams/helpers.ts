import type { NodeValue } from '@continuum-dev/contract';
import { ISSUE_CODES, ISSUE_SEVERITY } from '@continuum-dev/contract';
import { resolveNodeLookupEntry } from '../node-lookup.js';
import type { SessionState } from '../session-state.js';
import type { InternalSessionStreamState } from './types.js';

export function appendUnknownNodeStreamIssue(
  stream: InternalSessionStreamState,
  nodeId: string,
  message: string
): void {
  stream.issues = [
    ...stream.issues.filter(
      (issue) =>
        !(issue.code === ISSUE_CODES.UNKNOWN_NODE && issue.nodeId === nodeId)
    ),
    {
      severity: ISSUE_SEVERITY.WARNING,
      nodeId,
      message,
      code: ISSUE_CODES.UNKNOWN_NODE,
    },
  ];
}

export function resolveCommittedNode(
  internal: SessionState,
  requestedId: string
) {
  if (!internal.currentView) {
    return null;
  }

  return resolveNodeLookupEntry(internal.currentView.nodes, requestedId);
}

export function resolveStreamNode(
  stream: InternalSessionStreamState,
  requestedId: string
) {
  if (!stream.workingView) {
    return null;
  }

  return resolveNodeLookupEntry(stream.workingView.nodes, requestedId);
}

export function isProtectedValue(value: NodeValue | undefined): boolean {
  return Boolean(value?.isDirty || value?.isSticky);
}

export function getOpenStreamForTargetViewId(
  internal: SessionState,
  targetViewId: string
): InternalSessionStreamState | null {
  for (const stream of internal.streams.values()) {
    if (stream.status === 'open' && stream.targetViewId === targetViewId) {
      return stream;
    }
  }

  return null;
}
