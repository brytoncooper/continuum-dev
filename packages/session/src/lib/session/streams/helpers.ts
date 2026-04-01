import {
  getChildNodes,
  isProtectedNodeValue,
  type NodeValue,
  type ViewNode,
} from '@continuum-dev/contract';
import { ISSUE_CODES, ISSUE_SEVERITY } from '@continuum-dev/protocol';
import { resolveNodeLookupEntry } from '../node-lookup.js';
import type { SessionState } from '../state/index.js';
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

function collectStreamNodeMatches(
  nodes: ViewNode[],
  predicate: (node: ViewNode) => boolean,
  parentPath = '',
  matches: Array<{ canonicalId: string; node: ViewNode }> = []
): Array<{ canonicalId: string; node: ViewNode }> {
  for (const node of nodes) {
    const canonicalId =
      parentPath.length > 0 ? `${parentPath}/${node.id}` : node.id;
    if (predicate(node)) {
      matches.push({ canonicalId, node });
    }

    const children = getChildNodes(node);
    if (children.length > 0) {
      collectStreamNodeMatches(children, predicate, canonicalId, matches);
    }
  }

  return matches;
}

export function resolveStreamNodeForCommittedUpdate(
  internal: SessionState,
  stream: InternalSessionStreamState,
  requestedId: string
) {
  const direct = resolveStreamNode(stream, requestedId);
  if (direct) {
    return direct;
  }

  const committedLookup = resolveCommittedNode(internal, requestedId);
  const semanticKey = committedLookup?.node.semanticKey;
  if (!semanticKey || !stream.workingView) {
    return null;
  }

  const semanticMatches = collectStreamNodeMatches(
    stream.workingView.nodes,
    (node) => node.semanticKey === semanticKey
  );
  if (semanticMatches.length !== 1) {
    return null;
  }

  return {
    canonicalId: semanticMatches[0].canonicalId,
    node: semanticMatches[0].node,
    parentNode: null,
  };
}

export function isProtectedValue(value: NodeValue | undefined): boolean {
  return isProtectedNodeValue(value);
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
