import type {
  ContinuumTransformPlan,
  ContinuumTransformOperation,
  ViewDefinition,
} from '@continuum-dev/core';
import { resolveNodeLookupEntry } from '@continuum-dev/runtime/node-lookup';
import { buildPatchContext } from '../view-patching/index.js';

export interface NormalizedContinuumTransformPlan {
  plan: ContinuumTransformPlan | null;
  reason?: string;
}

function trimString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.map((item) => trimString(item)).filter(Boolean))] as string[];
}

function validateOperationAgainstViews(
  operation: ContinuumTransformOperation,
  currentView: ViewDefinition,
  nextView: ViewDefinition,
  index: number
): string | null {
  if (operation.kind === 'carry') {
    if (!resolveNodeLookupEntry(currentView.nodes, operation.sourceNodeId)) {
      return `Transform source node "${operation.sourceNodeId}" was not found in the current view.`;
    }
    if (!resolveNodeLookupEntry(nextView.nodes, operation.targetNodeId)) {
      return `Transform target node "${operation.targetNodeId}" was not found in the next view.`;
    }
    return null;
  }

  if (operation.kind === 'merge') {
    for (const sourceNodeId of operation.sourceNodeIds) {
      if (!resolveNodeLookupEntry(currentView.nodes, sourceNodeId)) {
        return `Transform source node "${sourceNodeId}" was not found in the current view.`;
      }
    }
    if (!resolveNodeLookupEntry(nextView.nodes, operation.targetNodeId)) {
      return `Transform target node "${operation.targetNodeId}" was not found in the next view.`;
    }
    return null;
  }

  if (operation.kind === 'split') {
    if (!resolveNodeLookupEntry(currentView.nodes, operation.sourceNodeId)) {
      return `Transform source node "${operation.sourceNodeId}" was not found in the current view.`;
    }
    for (const targetNodeId of operation.targetNodeIds) {
      if (!resolveNodeLookupEntry(nextView.nodes, targetNodeId)) {
        return `Transform target node "${targetNodeId}" was not found in the next view.`;
      }
    }
    return null;
  }

  const sourceNodeIds = operation.sourceNodeIds;
  for (const sourceNodeId of sourceNodeIds) {
    if (!resolveNodeLookupEntry(currentView.nodes, sourceNodeId)) {
      return `Transform source node "${sourceNodeId}" was not found in the current view.`;
    }
  }

  return null;
}

function normalizeOperation(
  value: unknown,
  currentView: ViewDefinition,
  nextView: ViewDefinition,
  index: number
): { operation: ContinuumTransformOperation | null; reason?: string } {
  if (!value || typeof value !== 'object') {
    return {
      operation: null,
      reason: `Transform operation ${index + 1} was invalid.`,
    };
  }

  const candidate = value as Record<string, unknown>;
  const kind = trimString(candidate.kind);
  if (!kind) {
    return {
      operation: null,
      reason: `Transform operation ${index + 1} was missing its kind.`,
    };
  }

  let operation: ContinuumTransformOperation | null = null;

  if (kind === 'carry') {
    const sourceNodeId = trimString(candidate.sourceNodeId);
    const targetNodeId = trimString(candidate.targetNodeId);
    if (!sourceNodeId || !targetNodeId) {
      return {
        operation: null,
        reason: `Transform operation ${index + 1} must include sourceNodeId and targetNodeId.`,
      };
    }
    operation = {
      kind,
      sourceNodeId,
      targetNodeId,
    };
  } else if (kind === 'merge') {
    const sourceNodeIds = normalizeStringArray(candidate.sourceNodeIds);
    const targetNodeId = trimString(candidate.targetNodeId);
    const strategyId = trimString(candidate.strategyId);
    if (sourceNodeIds.length === 0 || !targetNodeId || !strategyId) {
      return {
        operation: null,
        reason: `Transform operation ${index + 1} must include sourceNodeIds, a targetNodeId, and a strategyId.`,
      };
    }
    if (strategyId !== 'identity' && strategyId !== 'concat-space') {
      return {
        operation: null,
        reason: `Transform merge operation ${index + 1} used an unsupported strategy "${strategyId}".`,
      };
    }
    operation = {
      kind,
      sourceNodeIds,
      targetNodeId,
      strategyId,
    };
  } else if (kind === 'split') {
    const sourceNodeId = trimString(candidate.sourceNodeId);
    const targetNodeIds = normalizeStringArray(candidate.targetNodeIds);
    const strategyId = trimString(candidate.strategyId);
    if (!sourceNodeId || targetNodeIds.length < 2 || !strategyId) {
      return {
        operation: null,
        reason: `Transform operation ${index + 1} must include sourceNodeId, at least two targetNodeIds, and a strategyId.`,
      };
    }
    if (strategyId !== 'split-space') {
      return {
        operation: null,
        reason: `Transform split operation ${index + 1} used an unsupported strategy "${strategyId}".`,
      };
    }
    operation = {
      kind,
      sourceNodeId,
      targetNodeIds,
      strategyId,
    };
  } else if (kind === 'drop' || kind === 'detach') {
    const sourceNodeIds = normalizeStringArray(candidate.sourceNodeIds);
    if (sourceNodeIds.length === 0) {
      return {
        operation: null,
        reason: `Transform operation ${index + 1} must include at least one sourceNodeId.`,
      };
    }
    operation = {
      kind,
      sourceNodeIds,
      ...(trimString(candidate.reason)
        ? { reason: trimString(candidate.reason)! }
        : {}),
    };
  } else {
    return {
      operation: null,
      reason: `Transform operation ${index + 1} used an unsupported kind "${kind}".`,
    };
  }

  if (!operation) {
    return {
      operation: null,
      reason: `Transform operation ${index + 1} was invalid.`,
    };
  }

  const validationError = validateOperationAgainstViews(
    operation,
    currentView,
    nextView,
    index
  );
  if (validationError) {
    return {
      operation: null,
      reason: validationError,
    };
  }

  return { operation };
}

export function normalizeContinuumTransformPlan(
  value: unknown,
  currentView: ViewDefinition,
  nextView: ViewDefinition
): NormalizedContinuumTransformPlan {
  if (!value || typeof value !== 'object') {
    return {
      plan: null,
      reason: 'Transform mode did not return a valid JSON object.',
    };
  }

  const candidate = value as Record<string, unknown>;
  if (!Array.isArray(candidate.operations)) {
    return {
      plan: null,
      reason: 'Transform plan was missing an operations array.',
    };
  }

  const operations: ContinuumTransformOperation[] = [];
  for (const [index, operationValue] of candidate.operations.entries()) {
    const normalized = normalizeOperation(
      operationValue,
      currentView,
      nextView,
      index
    );
    if (!normalized.operation) {
      return {
        plan: null,
        reason: normalized.reason,
      };
    }
    operations.push(normalized.operation);
  }

  return {
    plan: {
      operations,
    },
  };
}

export function buildTransformSystemPrompt(): string {
  return [
    'You author deterministic Continuum transform plans between an existing view and the next view.',
    'Return exactly one JSON object and nothing else.',
    'Do not wrap the JSON in markdown fences.',
    'Response shape: {"operations":[...]}',
    'Only use these operation kinds: carry, merge, split, drop, detach.',
    'Only use built-in strategy ids: identity, concat-space, split-space.',
    'Use carry for 1:1 continuity.',
    'Use merge when multiple prior node values should become one next node value.',
    'Use split when one prior node value should become multiple next node values.',
    'Use drop only when the user clearly wants to discard prior data.',
    'Use detach when a prior value should stay recoverable but should not be auto-applied.',
    'Only reference source node ids that exist in the prior view and target node ids that exist in the next view.',
    'Prefer preserving user-entered values.',
    'Do not invent custom code, formulas, or unsupported strategies.',
  ].join('\n');
}

export function buildTransformUserMessage(args: {
  instruction: string;
  currentView: ViewDefinition;
  nextView: ViewDefinition;
  currentData: unknown;
  selectedTargets: string[];
}): string {
  const currentContext = buildPatchContext(args.currentView);
  const nextContext = buildPatchContext(args.nextView);

  return [
    'Return the Continuum transform plan as JSON only.',
    '',
    'Planner-selected targets:',
    JSON.stringify(args.selectedTargets, null, 2),
    '',
    'Prior view node index:',
    JSON.stringify(currentContext.nodeHints, null, 2),
    '',
    'Prior compact tree:',
    JSON.stringify(currentContext.compactTree, null, 2),
    '',
    'Next view node index:',
    JSON.stringify(nextContext.nodeHints, null, 2),
    '',
    'Next compact tree:',
    JSON.stringify(nextContext.compactTree, null, 2),
    '',
    'Current populated values:',
    JSON.stringify(args.currentData ?? null, null, 2),
    '',
    'Instruction:',
    args.instruction.trim(),
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Surgical transform: combined patch + continuity in one LLM call
// ---------------------------------------------------------------------------

export interface SurgicalTransformPlan {
  patchOperations: unknown[];
  continuityOperations: ContinuumTransformOperation[];
}

export interface NormalizedSurgicalTransformPlan {
  plan: SurgicalTransformPlan | null;
  reason?: string;
}

export function buildSurgicalTransformSystemPrompt(): string {
  return [
    'You produce surgical Continuum transform plans.',
    'A surgical transform combines structural changes to the view with data continuity instructions.',
    'Return exactly one JSON object and nothing else.',
    'Do not wrap the JSON in markdown fences.',
    'Response shape: {"patchOperations":[...],"continuityOperations":[...]}',
    '',
    'patchOperations modify the view structure. Supported kinds:',
    '- insert-node: add a new node subtree. Include parentId, optional position, and a complete node object.',
    '- replace-node: replace an existing node with a new subtree. Include nodeId and a complete node object.',
    '- remove-node: remove an existing node. Include nodeId.',
    '- move-node: reposition a node. Include nodeId and optional parentId/position.',
    '- wrap-nodes: wrap sibling nodes in a container. Include nodeIds and a wrapper node (group/row/grid).',
    '',
    'continuityOperations map data from prior nodes to new nodes. Supported kinds:',
    '- carry: 1:1 value transfer. Include sourceNodeId and targetNodeId.',
    '- merge: combine multiple source values into one target. Include sourceNodeIds, targetNodeId, and strategyId (identity or concat-space).',
    '- split: split one source value into multiple targets. Include sourceNodeId, targetNodeIds, and strategyId (split-space).',
    '- drop: explicitly discard prior values. Include sourceNodeIds.',
    '- detach: keep values recoverable but not auto-applied. Include sourceNodeIds.',
    '',
    'Rules:',
    '- Use only node ids that exist in the provided view for sources and existing-node references.',
    '- New nodes introduced via insert-node or replace-node may be referenced as targets in continuityOperations.',
    '- Every stateful field that is structurally changed must have a matching continuity operation.',
    '- Prefer the smallest set of patchOperations that achieves the requested change.',
    '- Preserve semantic keys and node keys when meaning is unchanged.',
    '- Prefer preserving user-entered values.',
    '- Do not invent custom strategies or unsupported operation kinds.',
  ].join('\n');
}

export function buildSurgicalTransformUserMessage(args: {
  instruction: string;
  currentView: ViewDefinition;
  currentData: unknown;
  selectedTargets: string[];
}): string {
  const context = buildPatchContext(args.currentView);

  return [
    'Return the surgical Continuum transform as JSON only.',
    '',
    'Planner-selected targets:',
    JSON.stringify(args.selectedTargets, null, 2),
    '',
    'Current view node index:',
    JSON.stringify(context.nodeHints, null, 2),
    '',
    'Current compact tree:',
    JSON.stringify(context.compactTree, null, 2),
    '',
    'Current populated values:',
    JSON.stringify(args.currentData ?? null, null, 2),
    '',
    'Instruction:',
    args.instruction.trim(),
  ].join('\n');
}

export function normalizeSurgicalTransformPlan(
  value: unknown,
  currentView: ViewDefinition
): NormalizedSurgicalTransformPlan {
  if (!value || typeof value !== 'object') {
    return {
      plan: null,
      reason: 'Surgical transform did not return a valid JSON object.',
    };
  }

  const candidate = value as Record<string, unknown>;

  if (
    !Array.isArray(candidate.patchOperations) &&
    !Array.isArray(candidate.continuityOperations)
  ) {
    return {
      plan: null,
      reason:
        'Surgical transform was missing both patchOperations and continuityOperations.',
    };
  }

  const patchOperations = Array.isArray(candidate.patchOperations)
    ? candidate.patchOperations
    : [];
  const rawContinuityOperations = Array.isArray(
    candidate.continuityOperations
  )
    ? candidate.continuityOperations
    : [];

  if (patchOperations.length === 0 && rawContinuityOperations.length === 0) {
    return {
      plan: null,
      reason: 'Surgical transform did not include any usable operations.',
    };
  }

  return {
    plan: {
      patchOperations,
      continuityOperations:
        rawContinuityOperations as ContinuumTransformOperation[],
    },
  };
}

