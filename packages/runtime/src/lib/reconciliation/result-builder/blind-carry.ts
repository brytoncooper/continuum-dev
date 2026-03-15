import type {
  DataSnapshot,
  NodeValue,
  ValueLineage,
  ViewDefinition,
  ViewNode,
} from '@continuum-dev/contract';
import { ISSUE_CODES, ISSUE_SEVERITY } from '@continuum-dev/contract';
import { collectDuplicateIssues } from '../../context/index.js';
import type {
  ReconciliationIssue,
  ReconciliationResult,
} from '../../types.js';
import { traverseViewNodes } from '../view-traversal/index.js';
import { buildLineageFromPrior } from './reconciled-lineage.js';
import type { BlindCarryResultInput } from './types.js';

export function buildBlindCarryResult(
  input: BlindCarryResultInput
): ReconciliationResult {
  const { newView, priorData, now, options } = input;
  const issues = buildBlindCarryIssues(newView);

  if (!options.allowBlindCarry) {
    return {
      reconciledState: {
        values: {},
        lineage: buildLineageFromPrior({
          priorLineage: priorData.lineage,
          now,
          newView,
        }),
        ...(hasDetachedValues(priorData)
          ? { detachedValues: { ...priorData.detachedValues } }
          : {}),
      },
      diffs: [],
      issues,
      resolutions: [],
    };
  }

  const carried = carryExactIdValues(newView.nodes, priorData, issues);

  return {
    reconciledState: {
      values: carried.values,
      lineage: buildLineageFromPrior({
        priorLineage: priorData.lineage,
        now,
        newView,
      }),
      ...(Object.keys(carried.valueLineage).length > 0
        ? { valueLineage: carried.valueLineage }
        : {}),
      ...(hasDetachedValues(priorData)
        ? { detachedValues: { ...priorData.detachedValues } }
        : {}),
    },
    diffs: [],
    issues,
    resolutions: [],
  };
}

function buildBlindCarryIssues(newView: ViewDefinition): ReconciliationIssue[] {
  return [
    {
      severity: ISSUE_SEVERITY.WARNING,
      message: 'Prior data exists but no prior view provided; cannot reconcile',
      code: ISSUE_CODES.NO_PRIOR_VIEW,
    },
    ...collectDuplicateIssues(newView.nodes),
  ];
}

function carryExactIdValues(
  newNodes: ViewNode[],
  priorData: DataSnapshot,
  issues: ReconciliationIssue[]
): {
  values: Record<string, NodeValue>;
  valueLineage: Record<string, ValueLineage>;
} {
  const newIds = collectNodeIds(newNodes);
  const values: Record<string, NodeValue> = {};
  const valueLineage: Record<string, ValueLineage> = {};

  for (const [nodeId, value] of Object.entries(priorData.values)) {
    if (!newIds.has(nodeId)) {
      continue;
    }

    values[nodeId] = value;

    const priorMeta = priorData.valueLineage?.[nodeId];
    if (priorMeta) {
      valueLineage[nodeId] = { ...priorMeta };
    }

    issues.push({
      severity: ISSUE_SEVERITY.INFO,
      nodeId,
      message: `Node ${nodeId} data carried without view validation`,
      code: ISSUE_CODES.UNVALIDATED_CARRY,
    });
  }

  return { values, valueLineage };
}

function collectNodeIds(nodes: ViewNode[]): Set<string> {
  const ids = new Set<string>();
  const traversal = traverseViewNodes({ nodes });
  for (const entry of traversal.visited) {
    ids.add(entry.nodeId);
  }
  return ids;
}

function hasDetachedValues(priorData: DataSnapshot): boolean {
  return Object.keys(priorData.detachedValues ?? {}).length > 0;
}
