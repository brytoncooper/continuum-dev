import type { ViewNode } from '@continuum-dev/core';
import type { ContinuumViewPatchPosition } from '@continuum-dev/runtime/state-ops';
import { normalizeViewDefinition } from '../view-guardrails/index.js';
import type { ViewPatchOperation, ViewPatchPlan } from './types.js';

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

export function normalizeViewPatchOperation(
  input: unknown
): ViewPatchOperation | null {
  if (!isRecord(input) || typeof input.kind !== 'string') {
    return null;
  }

  if (input.kind === 'insert-node') {
    const node = normalizePlanNode(input.node);
    const position = normalizePlanPosition(input.position);
    if (!node) {
      return null;
    }

    return {
      kind: 'insert-node',
      ...(typeof input.parentId === 'string' ? { parentId: input.parentId } : {}),
      ...(input.parentId === null ? { parentId: null } : {}),
      ...(position ? { position } : {}),
      node,
    };
  }

  if (input.kind === 'move-node') {
    const position = normalizePlanPosition(input.position);
    if (typeof input.nodeId !== 'string' || input.nodeId.trim().length === 0) {
      return null;
    }

    return {
      kind: 'move-node',
      nodeId: input.nodeId,
      ...(typeof input.parentId === 'string' ? { parentId: input.parentId } : {}),
      ...(input.parentId === null ? { parentId: null } : {}),
      ...(position ? { position } : {}),
    };
  }

  if (input.kind === 'wrap-nodes') {
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
      ...(typeof input.parentId === 'string' ? { parentId: input.parentId } : {}),
      ...(input.parentId === null ? { parentId: null } : {}),
      nodeIds: input.nodeIds,
      wrapper,
    };
  }

  if (input.kind === 'replace-node') {
    if (typeof input.nodeId !== 'string' || input.nodeId.trim().length === 0) {
      return null;
    }

    const node = normalizePlanNode(input.node);
    if (!node) {
      return null;
    }

    return {
      kind: 'replace-node',
      nodeId: input.nodeId,
      node,
    };
  }

  if (input.kind === 'remove-node') {
    if (typeof input.nodeId !== 'string' || input.nodeId.trim().length === 0) {
      return null;
    }

    return {
      kind: 'remove-node',
      nodeId: input.nodeId,
    };
  }

  if (input.kind === 'append-content') {
    if (
      typeof input.nodeId !== 'string' ||
      input.nodeId.trim().length === 0 ||
      typeof input.text !== 'string' ||
      input.text.length === 0
    ) {
      return null;
    }

    return {
      kind: 'append-content',
      nodeId: input.nodeId,
      text: input.text,
    };
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
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
