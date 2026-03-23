import type { NodeValue, ViewNode } from '@continuum-dev/contract';
import { ISSUE_CODES, ISSUE_SEVERITY } from '@continuum-dev/protocol';
import { collectDuplicateIssues } from '../../context/index.js';
import type {
  ReconciliationResolution,
  ReconciliationResult,
  StateDiff,
} from '../../types.js';
import { addedDiff, addedResolution } from '../differ/index.js';
import { createInitialCollectionValue } from '../collection-resolver/index.js';
import { traverseViewNodes } from '../view-traversal/index.js';
import { generateSessionId } from './view-hash.js';
import { buildFreshLineage } from './reconciled-lineage.js';
import type {
  FreshNodeCollectionInput,
  InitialSnapshotFromViewInput,
} from './types.js';

export function buildInitialSnapshotFromView(
  input: InitialSnapshotFromViewInput
): ReconciliationResult {
  const { newView, now } = input;
  const values: Record<string, NodeValue> = {};
  const diffs: StateDiff[] = [];
  const resolutions: ReconciliationResolution[] = [];

  collectFreshNodeState({
    nodes: newView.nodes,
    values,
    diffs,
    resolutions,
  });

  return {
    reconciledState: {
      values,
      lineage: buildFreshLineage({
        now,
        newView,
        sessionId: generateSessionId(now),
      }),
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

function collectFreshNodeState(input: FreshNodeCollectionInput): void {
  const traversal = traverseViewNodes({ nodes: input.nodes });
  for (const entry of traversal.visited) {
    initializeFreshNodeValue(input.values, entry.nodeId, entry.node);
    input.diffs.push(addedDiff(entry.nodeId));
    input.resolutions.push(addedResolution(entry.nodeId, entry.node.type));
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
