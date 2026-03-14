import type {
  NodeValue,
  ViewDefinition,
  ViewNode,
} from '@continuum-dev/contract';
import { ISSUE_CODES, ISSUE_SEVERITY } from '@continuum-dev/contract';
import { collectDuplicateIssues } from '../../context/index.js';
import type {
  ReconciliationResolution,
  ReconciliationResult,
  StateDiff,
} from '../../types.js';
import { addedDiff, addedResolution } from '../differ/index.js';
import { createInitialCollectionValue } from '../collection-resolver/index.js';
import { traverseViewNodes } from '../view-traversal.js';
import { generateSessionId } from './view-hash.js';

export function buildFreshSessionResult(
  newView: ViewDefinition,
  now: number
): ReconciliationResult {
  const values: Record<string, NodeValue> = {};
  const diffs: StateDiff[] = [];
  const resolutions: ReconciliationResolution[] = [];

  collectFreshNodeState(newView.nodes, values, diffs, resolutions);

  return {
    reconciledState: {
      values,
      lineage: {
        timestamp: now,
        sessionId: generateSessionId(now),
        viewId: newView.viewId,
        viewVersion: newView.version,
      },
    },
    diffs,
    issues: [
      {
        severity: ISSUE_SEVERITY.INFO,
        message: 'No prior state found, starting fresh',
        code: ISSUE_CODES.NO_PRIOR_DATA,
      },
      ...collectDuplicateIssues(newView.nodes),
    ],
    resolutions,
  };
}

function collectFreshNodeState(
  nodes: ViewNode[],
  values: Record<string, NodeValue>,
  diffs: StateDiff[],
  resolutions: ReconciliationResolution[]
): void {
  const traversal = traverseViewNodes(nodes);
  for (const entry of traversal.visited) {
    initializeFreshNodeValue(values, entry.nodeId, entry.node);
    diffs.push(addedDiff(entry.nodeId));
    resolutions.push(addedResolution(entry.nodeId, entry.node.type));
  }
}

function initializeFreshNodeValue(
  values: Record<string, NodeValue>,
  nodeId: string,
  node: ViewNode
): void {
  if (node.type === 'collection') {
    values[nodeId] = createInitialCollectionValue(node);
    return;
  }

  if ('defaultValue' in node && node.defaultValue !== undefined) {
    values[nodeId] = { value: node.defaultValue };
  }
}
