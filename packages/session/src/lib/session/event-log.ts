import type { ViewNode, Interaction, NodeValue, ValueLineage } from '@continuum/contract';
import { getChildNodes, ISSUE_CODES, ISSUE_SEVERITY, isInteractionType } from '@continuum/contract';
import type { SessionState } from './session-state.js';
import { generateId } from './session-state.js';
import { buildSnapshotFromCurrentState, notifySnapshotAndIssueListeners } from './listeners.js';
import { cloneCheckpointSnapshot } from './checkpoint-manager.js';
import { validateNodeValue } from '@continuum/runtime';

interface NodeLookupEntry {
  canonicalId: string;
  node: ViewNode;
}

function dedupeIssues(
  existing: SessionState['issues'],
  incoming: SessionState['issues']
): SessionState['issues'] {
  if (incoming.length === 0) {
    return existing;
  }
  const nextKeys = new Set(incoming.map((issue) => `${issue.nodeId ?? ''}:${issue.code}`));
  return [
    ...existing.filter((issue) => !nextKeys.has(`${issue.nodeId ?? ''}:${issue.code}`)),
    ...incoming,
  ];
}

function collectNodesByCanonicalId(nodes: ViewNode[]): Map<string, ViewNode> {
  const byId = new Map<string, ViewNode>();
  const walk = (items: ViewNode[], parentPath: string) => {
    for (const node of items) {
      const nodeId = parentPath.length > 0 ? `${parentPath}/${node.id}` : node.id;
      byId.set(nodeId, node);
      const children = getChildNodes(node);
      if (children.length > 0) {
        walk(children, nodeId);
      }
    }
  };
  walk(nodes, '');
  return byId;
}

function resolveNodeLookupEntry(nodes: ViewNode[], requestedId: string): NodeLookupEntry | null {
  const canonicalMap = collectNodesByCanonicalId(nodes);
  const direct = canonicalMap.get(requestedId);
  if (direct) {
    return { canonicalId: requestedId, node: direct };
  }

  const matches: NodeLookupEntry[] = [];
  const walk = (items: ViewNode[], parentPath: string) => {
    for (const node of items) {
      const canonicalId = parentPath.length > 0 ? `${parentPath}/${node.id}` : node.id;
      if (node.id === requestedId) {
        matches.push({ canonicalId, node });
      }
      const children = getChildNodes(node);
      if (children.length > 0) {
        walk(children, canonicalId);
      }
    }
  };
  walk(nodes, '');
  if (matches.length === 1) {
    return matches[0];
  }
  return null;
}

/**
 * Records an interaction event and applies its payload to current data state.
 *
 * The function updates event log, value lineage, optional validation issues,
 * and latest auto-checkpoint snapshot.
 *
 * @param internal Mutable internal session state.
 * @param partial Interaction payload without generated metadata.
 */
export function recordIntent(
  internal: SessionState,
  partial: Omit<Interaction, 'interactionId' | 'timestamp' | 'sessionId' | 'viewVersion'>
): void {
  if (internal.destroyed || !internal.currentData || !internal.currentView) return;
  if (!isInteractionType(partial.type)) {
    throw new Error(`Invalid interaction type: ${String(partial.type)}`);
  }

  const now = internal.clock();
  const id = generateId('int', internal.clock);

  const interaction: Interaction = {
    interactionId: id,
    sessionId: internal.sessionId,
    viewVersion: internal.currentView.version,
    timestamp: now,
    nodeId: partial.nodeId,
    type: partial.type,
    payload: partial.payload,
  };

  internal.eventLog.push(interaction);
  if (internal.eventLog.length > internal.maxEventLogSize) {
    internal.eventLog.splice(0, internal.eventLog.length - internal.maxEventLogSize);
  }

  const resolvedEntry = resolveNodeLookupEntry(internal.currentView.nodes, partial.nodeId);
  if (!resolvedEntry) {
    internal.issues = dedupeIssues(internal.issues, [{
      severity: ISSUE_SEVERITY.WARNING,
      nodeId: partial.nodeId,
      message: `Node ${partial.nodeId} not found in current view`,
      code: ISSUE_CODES.UNKNOWN_NODE,
    }]);
    notifySnapshotAndIssueListeners(internal);
    return;
  }
  const { canonicalId, node } = resolvedEntry;
  const payload = { ...(partial.payload as NodeValue) };

  internal.currentData = {
    ...internal.currentData,
    values: {
      ...internal.currentData.values,
      [canonicalId]: payload,
    },
    lineage: {
      ...internal.currentData.lineage,
      timestamp: now,
      lastInteractionId: id,
    },
    valueLineage: {
      ...internal.currentData.valueLineage,
      [canonicalId]: {
        lastUpdated: now,
        lastInteractionId: id,
      } as ValueLineage,
    },
  };

  if (internal.validateOnUpdate) {
    const validationIssues = validateNodeValue(
      node,
      payload
    );
    if (validationIssues.length > 0) {
      internal.issues = dedupeIssues(internal.issues, validationIssues);
    }
  }

  const lastAutoCheckpoint = [...internal.checkpoints]
    .reverse()
    .find((checkpoint) => checkpoint.trigger === 'auto');
  if (lastAutoCheckpoint) {
    const snapshot = buildSnapshotFromCurrentState(internal);
    if (snapshot) {
      lastAutoCheckpoint.snapshot = cloneCheckpointSnapshot(snapshot);
    }
  }

  notifySnapshotAndIssueListeners(internal);
}
