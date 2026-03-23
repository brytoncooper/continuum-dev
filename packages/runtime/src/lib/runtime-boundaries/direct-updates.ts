import {
  type DataSnapshot,
  type NodeValue,
  type ViewDefinition,
} from '@continuum-dev/contract';

import { ISSUE_CODES, ISSUE_SEVERITY } from '@continuum-dev/protocol';

import { validateNodeValue } from '../validator/index.js';

import { sanitizeContinuumDataSnapshot } from './canonical-data.js';

import { resolveNodeLookupEntry } from './node-lookup.js';

import type {
  ApplyContinuumNodeValueWriteInput,
  ApplyContinuumNodeValueWriteResult,
  DecideContinuumNodeValueWriteInput,
  ContinuumNodeValueWriteDecision,
} from './types.js';

/**
 * Decides whether a non-user value write should apply immediately or become a proposal.
 */
export function decideContinuumNodeValueWrite(
  input: DecideContinuumNodeValueWriteInput
): ContinuumNodeValueWriteDecision {
  if (!input.view) {
    return {
      kind: 'unknown-node',

      nodeId: input.nodeId,

      issues: buildUnknownNodeIssues(input.nodeId),
    };
  }

  const lookup = resolveNodeLookupEntry(input.view.nodes, input.nodeId);

  if (!lookup) {
    return {
      kind: 'unknown-node',

      nodeId: input.nodeId,

      issues: buildUnknownNodeIssues(input.nodeId),
    };
  }

  const currentValue = input.data?.values[lookup.canonicalId];

  if (isProtectedValue(currentValue)) {
    return {
      kind: 'proposal',

      canonicalId: lookup.canonicalId,

      node: lookup.node,

      currentValue,
    };
  }

  return {
    kind: 'apply',

    canonicalId: lookup.canonicalId,

    node: lookup.node,

    currentValue,
  };
}

/**
 * Applies one node value write to canonical snapshot data and updates lineage metadata.
 */
export function applyContinuumNodeValueWrite(
  input: ApplyContinuumNodeValueWriteInput
): ApplyContinuumNodeValueWriteResult {
  const currentData = sanitizeContinuumDataSnapshot(input.data);

  if (!input.view) {
    return {
      kind: 'unknown-node',

      nodeId: input.nodeId,

      data: currentData,

      issues: buildUnknownNodeIssues(input.nodeId),
    };
  }

  const lookup = resolveNodeLookupEntry(input.view.nodes, input.nodeId);

  if (!lookup) {
    return {
      kind: 'unknown-node',

      nodeId: input.nodeId,

      data: currentData,

      issues: buildUnknownNodeIssues(input.nodeId),
    };
  }

  const next = ensureSnapshot(
    currentData,

    input.sessionId,

    input.timestamp,

    input.view
  );

  const issues =
    input.validate === true ? validateNodeValue(lookup.node, input.value) : [];

  return {
    kind: 'applied',

    canonicalId: lookup.canonicalId,

    node: lookup.node,

    data: sanitizeContinuumDataSnapshot({
      ...next,

      values: {
        ...next.values,

        [lookup.canonicalId]: input.value,
      },

      lineage: {
        ...next.lineage,

        timestamp: input.timestamp,

        viewId: input.view?.viewId ?? next.lineage.viewId,

        viewVersion: input.view?.version ?? next.lineage.viewVersion,

        ...(input.interactionId
          ? { lastInteractionId: input.interactionId }
          : {}),
      },

      valueLineage: {
        ...(next.valueLineage ?? {}),

        [lookup.canonicalId]: {
          ...(next.valueLineage?.[lookup.canonicalId] ?? {}),

          lastUpdated: input.timestamp,

          ...(input.interactionId
            ? { lastInteractionId: input.interactionId }
            : {}),
        },
      },
    })!,

    issues,
  };
}

function buildUnknownNodeIssues(nodeId: string) {
  return [
    {
      severity: ISSUE_SEVERITY.WARNING,

      nodeId,

      message: `Node ${nodeId} not found in current view`,

      code: ISSUE_CODES.UNKNOWN_NODE,
    },
  ];
}

function ensureSnapshot(
  data: DataSnapshot | null,

  sessionId: string,

  timestamp: number,

  view: ViewDefinition | null
): DataSnapshot {
  const sanitized = sanitizeContinuumDataSnapshot(data);

  if (sanitized) {
    return sanitized;
  }

  return {
    values: {},

    lineage: {
      timestamp,

      sessionId,

      viewId: view?.viewId,

      viewVersion: view?.version,
    },
  };
}

function isProtectedValue(value: NodeValue | undefined): boolean {
  return Boolean(value?.isDirty || value?.isSticky);
}
