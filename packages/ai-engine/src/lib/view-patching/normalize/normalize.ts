import type { ViewNode } from '@continuum-dev/core';
import type { ContinuumViewPatchPosition } from '@continuum-dev/protocol';
import { normalizeViewDefinition } from '../../view-guardrails/index.js';
import type { ViewPatchOperation, ViewPatchPlan } from '../types.js';

export interface NormalizedViewPatchPlanResult {
  plan: ViewPatchPlan | null;
  reason?: string;
}

function isLocalPatchPlanInput(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  if (!Array.isArray(candidate.operations)) {
    return false;
  }

  if (candidate.mode === 'full') {
    return false;
  }

  if (candidate.mode !== undefined && candidate.mode !== 'patch') {
    return false;
  }

  return true;
}

export function isViewPatchPlan(value: unknown): value is ViewPatchPlan {
  if (!isLocalPatchPlanInput(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return Array.isArray(candidate.operations);
}

export function normalizeViewPatchPlan(
  input: unknown
): NormalizedViewPatchPlanResult {
  if (isRecord(input) && input.mode === 'full') {
    return {
      plan: null,
      reason:
        'Full view escalation is not supported in the patch lane; use execution mode view instead.',
    };
  }

  if (!isLocalPatchPlanInput(input)) {
    return {
      plan: null,
      reason: 'Patch response did not match the expected plan shape.',
    };
  }

  const candidate = input as Record<string, unknown>;
  const rawOperations = candidate.operations as unknown[];

  const operations: ViewPatchOperation[] = [];
  for (const [index, operation] of rawOperations.entries()) {
    const normalizedOperation = normalizeViewPatchOperation(operation);
    if (!normalizedOperation) {
      return {
        plan: null,
        reason: `Patch operation ${index + 1} was invalid or unsupported.`,
      };
    }

    operations.push(normalizedOperation);
  }

  if (operations.length === 0) {
    return {
      plan: null,
      reason: 'Patch plan did not include any usable operations.',
    };
  }

  return {
    plan: {
      operations,
      ...(typeof candidate.reason === 'string' && candidate.reason.trim().length > 0
        ? { reason: candidate.reason.trim() }
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

  const target = resolvePatchTarget(input);

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
      ...(typeof input.parentSemanticKey === 'string' &&
      input.parentSemanticKey.trim().length > 0
        ? { parentSemanticKey: input.parentSemanticKey.trim() }
        : {}),
      ...(input.parentSemanticKey === null
        ? { parentSemanticKey: null }
        : {}),
      ...(position ? { position } : {}),
      node,
    };
  }

  if (kind === 'move-node') {
    const position = normalizePlanPosition(input.position);
    if (!target) {
      return null;
    }

    return {
      kind: 'move-node',
      ...target,
      ...(typeof input.parentId === 'string'
        ? { parentId: input.parentId }
        : {}),
      ...(input.parentId === null ? { parentId: null } : {}),
      ...(typeof input.parentSemanticKey === 'string' &&
      input.parentSemanticKey.trim().length > 0
        ? { parentSemanticKey: input.parentSemanticKey.trim() }
        : {}),
      ...(input.parentSemanticKey === null
        ? { parentSemanticKey: null }
        : {}),
      ...(position ? { position } : {}),
    };
  }

  if (kind === 'wrap-nodes') {
    if (
      !hasNonEmptyStringArray(input.nodeIds) &&
      !hasNonEmptyStringArray(input.semanticKeys)
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
      ...(typeof input.parentSemanticKey === 'string' &&
      input.parentSemanticKey.trim().length > 0
        ? { parentSemanticKey: input.parentSemanticKey.trim() }
        : {}),
      ...(input.parentSemanticKey === null
        ? { parentSemanticKey: null }
        : {}),
      ...(hasNonEmptyStringArray(input.nodeIds)
        ? { nodeIds: input.nodeIds.map((id) => id.trim()) }
        : {}),
      ...(hasNonEmptyStringArray(input.semanticKeys)
        ? {
            semanticKeys: input.semanticKeys.map((semanticKey) =>
              semanticKey.trim()
            ),
          }
        : {}),
      wrapper,
    };
  }

  if (kind === 'replace-node') {
    if (!target) {
      return null;
    }

    const node = normalizePlanNode(input.node);
    if (!node) {
      return null;
    }

    return {
      kind: 'replace-node',
      ...target,
      node,
    };
  }

  if (kind === 'remove-node') {
    if (!target) {
      return null;
    }

    return {
      kind: 'remove-node',
      ...target,
    };
  }

  if (kind === 'append-content') {
    if (!target || typeof input.text !== 'string' || input.text.length === 0) {
      return null;
    }

    return {
      kind: 'append-content',
      ...target,
      text: input.text,
    };
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function resolvePatchTarget(
  input: Record<string, unknown>
): { nodeId?: string; semanticKey?: string } | null {
  if (typeof input.nodeId === 'string' && input.nodeId.trim().length > 0) {
    return { nodeId: input.nodeId.trim() };
  }
  if (typeof input.id === 'string' && input.id.trim().length > 0) {
    return { nodeId: input.id.trim() };
  }
  if (typeof input.targetId === 'string' && input.targetId.trim().length > 0) {
    return { nodeId: input.targetId.trim() };
  }
  if (
    typeof input.semanticKey === 'string' &&
    input.semanticKey.trim().length > 0
  ) {
    return { semanticKey: input.semanticKey.trim() };
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
  if (
    typeof input.beforeSemanticKey === 'string' &&
    input.beforeSemanticKey.trim().length > 0
  ) {
    position.beforeSemanticKey = input.beforeSemanticKey.trim();
  }
  if (
    typeof input.afterSemanticKey === 'string' &&
    input.afterSemanticKey.trim().length > 0
  ) {
    position.afterSemanticKey = input.afterSemanticKey.trim();
  }
  if (typeof input.index === 'number' && Number.isInteger(input.index)) {
    position.index = input.index;
  }

  return Object.keys(position).length > 0 ? position : undefined;
}

function hasNonEmptyStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (entry) => typeof entry === 'string' && entry.trim().length > 0
    )
  );
}
