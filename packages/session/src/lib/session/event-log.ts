import type {
  ViewNode,
  Interaction,
  NodeValue,
  ValueLineage,
} from '@continuum/contract';
import { getChildNodes, ISSUE_CODES, ISSUE_SEVERITY } from '@continuum/contract';
import type { SessionState } from './session-state.js';
import { generateId } from './session-state.js';
import { buildSnapshotFromCurrentState, notifySnapshotAndIssueListeners } from './listeners.js';
import { cloneCheckpointSnapshot } from './checkpoint-manager.js';
import { validateNodeValue } from '@continuum/runtime';

function collectNodesById(nodes: ViewNode[]): Map<string, ViewNode> {
  const byId = new Map<string, ViewNode>();
  const walk = (items: ViewNode[]) => {
    for (const node of items) {
      byId.set(node.id, node);
      const children = getChildNodes(node);
      if (children.length > 0) {
        walk(children);
      }
    }
  };
  walk(nodes);
  return byId;
}

export function recordIntent(
  internal: SessionState,
  partial: Omit<Interaction, 'interactionId' | 'timestamp' | 'sessionId' | 'viewVersion'>
): void {
  if (internal.destroyed || !internal.currentData || !internal.currentView) return;

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

  const nodeMap = collectNodesById(internal.currentView.nodes);
  const nodeDefinition = nodeMap.get(partial.nodeId);
  if (!nodeDefinition) {
    internal.issues = [
      ...internal.issues,
      {
        severity: ISSUE_SEVERITY.WARNING,
        nodeId: partial.nodeId,
        message: `Node ${partial.nodeId} not found in current view`,
        code: ISSUE_CODES.UNKNOWN_NODE,
      },
    ];
    notifySnapshotAndIssueListeners(internal);
    return;
  }

  internal.currentData = {
    ...internal.currentData,
    values: {
      ...internal.currentData.values,
      [partial.nodeId]: partial.payload as NodeValue,
    },
    lineage: {
      ...internal.currentData.lineage,
      timestamp: now,
      lastInteractionId: id,
    },
    valueLineage: {
      ...internal.currentData.valueLineage,
      [partial.nodeId]: {
        lastUpdated: now,
        lastInteractionId: id,
      } as ValueLineage,
    },
  };

  if (internal.validateOnUpdate) {
    const validationIssues = validateNodeValue(
      nodeDefinition,
      partial.payload as NodeValue
    );
    if (validationIssues.length > 0) {
      internal.issues = [...internal.issues, ...validationIssues];
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
