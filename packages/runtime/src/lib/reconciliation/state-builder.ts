import type {
  DataSnapshot,
  DetachedValue,
  NodeValue,
  ValueLineage,
  ViewDefinition,
  ViewNode,
} from '@continuum/contract';
import {
  getChildNodes,
  ISSUE_CODES,
  ISSUE_SEVERITY,
} from '@continuum/contract';
import { collectDuplicateIssues } from '../context.js';
import type {
  NodeResolutionAccumulator,
  ReconciliationIssue,
  ReconciliationOptions,
  ReconciliationResult,
  StateDiff,
  ReconciliationResolution,
} from '../types.js';
import { addedDiff, addedResolution } from './differ.js';

export function buildFreshSessionResult(
  newView: ViewDefinition,
  now: number
): ReconciliationResult {
  const values: Record<string, NodeValue> = {};
  const diffs: StateDiff[] = [];
  const resolutions: ReconciliationResolution[] = [];

  collectNodesAsFreshlyAdded(newView.nodes, values, diffs, resolutions);

  const duplicateIssues = collectDuplicateIssues(newView.nodes);

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
      ...duplicateIssues,
    ],
    resolutions,
  };
}

function collectNodesAsFreshlyAdded(
  nodes: ViewNode[],
  values: Record<string, NodeValue>,
  diffs: StateDiff[],
  resolutions: ReconciliationResolution[]
): void {
  for (const node of nodes) {
    if ('defaultValue' in node && node.defaultValue !== undefined) {
      values[node.id] = { value: node.defaultValue };
    }
    diffs.push(addedDiff(node.id));
    resolutions.push(addedResolution(node.id, node.type));
    const children = getChildNodes(node);
    if (children.length > 0) {
      collectNodesAsFreshlyAdded(children, values, diffs, resolutions);
    }
  }
}

function collectNodeIds(nodes: ViewNode[]): Set<string> {
  const ids = new Set<string>();

  function walk(items: ViewNode[]): void {
    for (const node of items) {
      ids.add(node.id);
      const children = getChildNodes(node);
      if (children.length > 0) {
        walk(children);
      }
    }
  }

  walk(nodes);
  return ids;
}

export function buildBlindCarryResult(
  newView: ViewDefinition,
  priorData: DataSnapshot,
  now: number,
  options: ReconciliationOptions
): ReconciliationResult {
  const duplicateIssues = collectDuplicateIssues(newView.nodes);
  const issues: ReconciliationIssue[] = [
    {
      severity: ISSUE_SEVERITY.WARNING,
      message: 'Prior data exists but no prior view provided; cannot reconcile',
      code: ISSUE_CODES.NO_PRIOR_VIEW,
    },
    ...duplicateIssues,
  ];

  if (options.allowBlindCarry) {
    const newIds = collectNodeIds(newView.nodes);
    const carriedValues: Record<string, NodeValue> = {};
    for (const [id, value] of Object.entries(priorData.values)) {
      if (newIds.has(id)) {
        carriedValues[id] = value;
        issues.push({
          severity: ISSUE_SEVERITY.INFO,
          nodeId: id,
          message: `Node ${id} data carried without view validation`,
          code: ISSUE_CODES.UNVALIDATED_CARRY,
        });
      }
    }

    return {
      reconciledState: {
        values: carriedValues,
        lineage: {
          ...priorData.lineage,
          timestamp: now,
          viewId: newView.viewId,
          viewVersion: newView.version,
        },
      },
      diffs: [],
      issues,
      resolutions: [],
    };
  }

  return {
    reconciledState: {
      values: {},
      lineage: {
        ...priorData.lineage,
        timestamp: now,
        viewId: newView.viewId,
        viewVersion: newView.version,
      },
    },
    diffs: [],
    issues,
    resolutions: [],
  };
}

export function assembleReconciliationResult(
  resolved: NodeResolutionAccumulator,
  removals: { diffs: StateDiff[]; issues: ReconciliationIssue[]; detachedValues?: Record<string, DetachedValue> },
  priorData: DataSnapshot,
  newView: ViewDefinition,
  now: number
): ReconciliationResult {
  const viewHash = computeViewHash(newView);
  const hasValueLineage = Object.keys(resolved.valueLineage).length > 0;
  const detachedValues = {
    ...(priorData.detachedValues ?? {}),
    ...(resolved.detachedValues ?? {}),
    ...(removals.detachedValues ?? {}),
  };
  for (const restoredKey of resolved.restoredDetachedKeys ?? []) {
    delete detachedValues[restoredKey];
  }
  const hasDetachedValues = Object.keys(detachedValues).length > 0;

  return {
    reconciledState: {
      values: resolved.values,
      lineage: {
        ...priorData.lineage,
        timestamp: now,
        viewId: newView.viewId,
        viewVersion: newView.version,
        ...(viewHash !== undefined ? { viewHash } : {}),
      },
      ...(hasValueLineage ? { valueLineage: resolved.valueLineage } : {}),
      ...(hasDetachedValues ? { detachedValues } : {}),
    },
    diffs: [...resolved.diffs, ...removals.diffs],
    issues: [...resolved.issues, ...removals.issues],
    resolutions: resolved.resolutions,
  };
}

export function carryValuesMeta(
  target: Record<string, ValueLineage>,
  newId: string,
  priorId: string,
  priorData: DataSnapshot,
  now: number,
  isMigrated: boolean
): void {
  const priorMeta = priorData.valueLineage?.[priorId];
  if (priorMeta) {
    target[newId] = isMigrated
      ? { ...priorMeta, lastUpdated: now }
      : { ...priorMeta };
  }
}

export function computeViewHash(view: ViewDefinition): string | undefined {
  const hashes: string[] = [];
  function collect(nodes: ViewNode[]) {
    for (const node of nodes) {
      if (node.hash) hashes.push(node.hash);
      const children = getChildNodes(node);
      if (children.length > 0) {
        collect(children);
      }
    }
  }
  collect(view.nodes);
  if (hashes.length === 0) return undefined;
  return JSON.stringify(hashes.sort());
}

export function generateSessionId(now: number): string {
  return `session_${now}_${Math.random().toString(36).substring(2, 9)}`;
}
