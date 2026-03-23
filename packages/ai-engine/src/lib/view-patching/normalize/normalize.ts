import type { ViewNode } from '@continuum-dev/core';
import type { ContinuumViewPatchPosition } from '@continuum-dev/protocol';
import { normalizeViewDefinition } from '../../view-guardrails/index.js';
import type { ViewPatchOperation, ViewPatchPlan } from '../types.js';

export interface NormalizedViewPatchPlanResult {
  plan: ViewPatchPlan | null;
  reason?: string;
}

export function isViewPatchPlan(value: unknown): value is ViewPatchPlan {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  if (candidate.mode !== 'patch' && candidate.mode !== 'full') {
    return false;
  }
  return Array.isArray(candidate.operations);
}

export function normalizeViewPatchPlan(
  input: unknown
): NormalizedViewPatchPlanResult {
  if (!isViewPatchPlan(input)) {
    return {
      plan: null,
      reason: 'Patch response did not match the expected plan shape.',
    };
  }

  const operations: ViewPatchOperation[] = [];
  for (const [index, operation] of input.operations.entries()) {
    const normalizedOperation = normalizeViewPatchOperation(operation);
    if (!normalizedOperation) {
      return {
        plan: null,
        reason: `Patch operation ${index + 1} was invalid or unsupported.`,
      };
    }

    operations.push(normalizedOperation);
  }

  if (input.mode === 'patch' && operations.length === 0) {
    return {
      plan: null,
      reason: 'Patch plan did not include any usable operations.',
    };
  }

  return {
    plan: {
      mode: input.mode,
      operations,
      ...(typeof input.reason === 'string' && input.reason.trim().length > 0
        ? { reason: input.reason.trim() }
        : {}),
      ...(input.fullStrategy === 'evolve' || input.fullStrategy === 'replace'
        ? { fullStrategy: input.fullStrategy }
        : {}),
    },
  };
}

export function normalizeViewPatchOperation(
  input: unknown
): ViewPatchOperation | null {
  if (!isRecord(input)) {
    return null;
  }

  const kind =
    typeof input.kind === 'string'
      ? input.kind
      : typeof input.op === 'string'
      ? input.op
      : typeof input.type === 'string'
      ? input.type
      : null;
  if (!kind) {
    return null;
  }

  const nodeId = resolvePatchTargetNodeId(input);

  if (kind === 'insert-node') {
    const node = normalizePlanNode(input.node);
    const position = normalizePlanPosition(input.position);
    if (!node) {
      return null;
    }

    return {
      kind: 'insert-node',
      ...(typeof input.parentId === 'string'
        ? { parentId: input.parentId }
        : {}),
      ...(input.parentId === null ? { parentId: null } : {}),
      ...(position ? { position } : {}),
      node,
    };
  }

  if (kind === 'move-node') {
    const position = normalizePlanPosition(input.position);
    if (!nodeId) {
      return null;
    }

    return {
      kind: 'move-node',
      nodeId,
      ...(typeof input.parentId === 'string'
        ? { parentId: input.parentId }
        : {}),
      ...(input.parentId === null ? { parentId: null } : {}),
      ...(position ? { position } : {}),
    };
  }

  if (kind === 'wrap-nodes') {
    if (
      !Array.isArray(input.nodeIds) ||
      input.nodeIds.length === 0 ||
      input.nodeIds.some(
        (nodeId) => typeof nodeId !== 'string' || nodeId.trim().length === 0
      )
    ) {
      return null;
    }

    const wrapper = normalizePlanNode(input.wrapper);
    if (
      !wrapper ||
      (wrapper.type !== 'group' &&
        wrapper.type !== 'row' &&
        wrapper.type !== 'grid')
    ) {
      return null;
    }

    return {
      kind: 'wrap-nodes',
      ...(typeof input.parentId === 'string'
        ? { parentId: input.parentId }
        : {}),
      ...(input.parentId === null ? { parentId: null } : {}),
      nodeIds: input.nodeIds,
      wrapper,
    };
  }

  if (kind === 'replace-node') {
    if (!nodeId) {
      return null;
    }

    const node = normalizePlanNode(input.node);
    if (!node) {
      return null;
    }

    return {
      kind: 'replace-node',
      nodeId,
      node,
    };
  }

  if (kind === 'remove-node') {
    if (!nodeId) {
      return null;
    }

    return {
      kind: 'remove-node',
      nodeId,
    };
  }

  if (kind === 'append-content') {
    if (!nodeId || typeof input.text !== 'string' || input.text.length === 0) {
      return null;
    }

    return {
      kind: 'append-content',
      nodeId,
      text: input.text,
    };
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function resolvePatchTargetNodeId(
  input: Record<string, unknown>
): string | null {
  if (typeof input.nodeId === 'string' && input.nodeId.trim().length > 0) {
    return input.nodeId.trim();
  }
  if (typeof input.id === 'string' && input.id.trim().length > 0) {
    return input.id.trim();
  }
  if (typeof input.targetId === 'string' && input.targetId.trim().length > 0) {
    return input.targetId.trim();
  }
  return null;
}

function normalizePlanNode(node: unknown): ViewNode | null {
  if (!isRecord(node)) {
    return null;
  }

  const normalizedView = normalizeViewDefinition({
    viewId: 'normalized_plan',
    version: '1',
    nodes: [node as unknown as ViewNode],
  });

  return normalizedView.nodes[0] ?? null;
}

function normalizePlanPosition(
  input: unknown
): ContinuumViewPatchPosition | undefined {
  if (!isRecord(input)) {
    return undefined;
  }

  const position: ContinuumViewPatchPosition = {};
  if (typeof input.beforeId === 'string' && input.beforeId.trim().length > 0) {
    position.beforeId = input.beforeId;
  }
  if (typeof input.afterId === 'string' && input.afterId.trim().length > 0) {
    position.afterId = input.afterId;
  }
  if (typeof input.index === 'number' && Number.isInteger(input.index)) {
    position.index = input.index;
  }

  return Object.keys(position).length > 0 ? position : undefined;
}
