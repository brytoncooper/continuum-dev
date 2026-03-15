import {
  applyContinuumViewStreamPart,
  type ContinuumViewPatchPosition,
  type ViewDefinition,
  type ViewNode,
} from '@continuum-dev/core';
import type {
  DetachedFieldHint,
  PromptOutputContract,
} from '@continuum-dev/prompts';
import type {
  CompactPatchNode,
  PatchNodeHint,
} from './patch-context.js';
import {
  normalizeViewDefinition,
  SUPPORTED_NODE_TYPE_VALUES,
} from './view-guardrails.js';

export type ViewPatchOperation =
  | {
      kind: 'insert-node';
      parentId?: string | null;
      position?: ContinuumViewPatchPosition;
      node: ViewNode;
    }
  | {
      kind: 'move-node';
      nodeId: string;
      parentId?: string | null;
      position?: ContinuumViewPatchPosition;
    }
  | {
      kind: 'wrap-nodes';
      parentId?: string | null;
      nodeIds: string[];
      wrapper: ViewNode;
    }
  | {
      kind: 'replace-node';
      nodeId: string;
      node: ViewNode;
    }
  | {
      kind: 'remove-node';
      nodeId: string;
    }
  | {
      kind: 'append-content';
      nodeId: string;
      text: string;
    };

export interface ViewPatchPlan {
  mode: 'patch' | 'full';
  operations: ViewPatchOperation[];
  reason?: string;
  fullStrategy?: 'evolve' | 'replace';
}

export const VIEW_PATCH_OUTPUT_CONTRACT: PromptOutputContract = {
  name: 'continuum_view_patch',
  strict: false,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['mode', 'operations'],
    properties: {
      mode: {
        type: 'string',
      },
      reason: {
        type: 'string',
      },
      fullStrategy: {
        type: 'string',
      },
      operations: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['kind'],
          properties: {
            kind: { type: 'string' },
            parentId: {
              type: ['string', 'null'],
            },
            position: {
              type: 'object',
              additionalProperties: false,
              properties: {
                beforeId: { type: 'string' },
                afterId: { type: 'string' },
                index: { type: 'number' },
              },
            },
            nodeId: { type: 'string' },
            nodeIds: {
              type: 'array',
              items: { type: 'string' },
            },
            text: { type: 'string' },
            node: { type: 'object' },
            wrapper: { type: 'object' },
          },
        },
      },
    },
  },
};

export function buildPatchSystemPrompt(): string {
  return [
    'You generate Continuum update plans for small, localized Continuum UI edits.',
    'Return JSON only.',
    'Do not wrap the JSON in markdown fences.',
    'Do not include commentary before or after the JSON.',
    'Mode options:',
    '- mode="patch": return explicit update operations for small updates.',
    '- mode="full": return no operations when patching is unsafe or ambiguous.',
    '- When mode="full", include fullStrategy as either "evolve" or "replace".',
    'Rules:',
    '- Prefer mode="patch" when the user asks for a localized change.',
    '- If instruction implies a brand new or replacement workflow, choose mode="full" and fullStrategy="replace".',
    '- If instruction can still evolve the current workflow but patching is unsafe, choose mode="full" and fullStrategy="evolve".',
    '- Supported operation kinds are: insert-node, move-node, wrap-nodes, replace-node, remove-node, append-content.',
    '- insert-node adds one full node subtree at a parent or the top level.',
    '- move-node repositions one existing node into a parent or the top level without rewriting the subtree.',
    '- wrap-nodes wraps existing sibling nodes in a new group/row/grid container.',
    '- replace-node replaces one existing node with a complete valid replacement subtree.',
    '- remove-node removes one existing node.',
    '- append-content is only for appending text to an existing presentation node. If content is being rewritten, use replace-node instead.',
    '- For property tweaks on an existing node, use replace-node with the complete updated node object. Do not invent a separate prop-level patch language.',
    '- Use only node ids and parent ids that exist in the provided node index/tree unless you are introducing a brand-new inserted node.',
    '- Prefer the smallest valid operation list that satisfies the request.',
    '- Preserve semantic continuity and detached key continuity.',
    '- For layout-only regroupings, prefer move-node or wrap-nodes over replacing a large subtree.',
    '- For stateful fields that move structurally, preserve semanticKey and keep the same field id whenever possible.',
    '- If user asks to re-add a previously detached field, reuse its detached key as node key.',
    '- Use previousLabel and previousParentLabel on detached fields as semantic clues for restore requests.',
    '- Do not reuse a detachedKey for a different concept just because the value preview looks similar.',
    '- Groups are for major sections and semantic clustering.',
    '- Rows are for 2-3 short related fields on one line.',
    '- Grids are for compact peer fields or card-like items.',
    '- Collections are only for repeatable user-managed items.',
    '- Every collection must include a complete template node. The template should usually be a group/row/grid that contains the actual child fields.',
    '- Do not create an empty collection template. A collection without real template fields is invalid.',
    '- If you add or keep a collection, ensure it starts with at least one initial item via defaultValues unless the user explicitly asks for an empty collection.',
    `- Supported node types are: ${SUPPORTED_NODE_TYPE_VALUES.join(', ')}.`,
  ].join('\n');
}

export function buildPatchUserMessage(args: {
  viewId: string;
  version: string;
  instruction: string;
  nodeHints: PatchNodeHint[];
  compactTree: CompactPatchNode[];
  detachedFields: DetachedFieldHint[];
}): string {
  return [
    `Current view:\n${JSON.stringify(
      {
        viewId: args.viewId,
        version: args.version,
      },
      null,
      2
    )}`,
    'The node index lists existing ids, keys, labels, and structural hints. Use it to target existing nodes precisely.',
    `Node index:\n${JSON.stringify(args.nodeHints, null, 2)}`,
    'The compact tree shows the full current hierarchy. When you replace or insert a collection, include a complete collection node with a valid template subtree and any needed defaultValues.',
    `Compact full tree snapshot:\n${JSON.stringify(args.compactTree, null, 2)}`,
    'Detached fields are prior removed fields available for restoration. Match by semantic meaning using detachedKey, previousLabel, and previousParentLabel.',
    `Detached fields:\n${
      args.detachedFields.length > 0
        ? JSON.stringify(args.detachedFields, null, 2)
        : 'none'
    }`,
    `Instruction:\n${args.instruction.trim()}`,
  ].join('\n\n');
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

function normalizePlanOperation(input: unknown): ViewPatchOperation | null {
  if (!isRecord(input) || typeof input.kind !== 'string') {
    return null;
  }

  if (input.kind === 'insert-node') {
    const node = normalizePlanNode(input.node);
    if (!node) {
      return null;
    }

    return {
      kind: 'insert-node',
      ...(typeof input.parentId === 'string' ? { parentId: input.parentId } : {}),
      ...(input.parentId === null ? { parentId: null } : {}),
      ...(normalizePlanPosition(input.position)
        ? { position: normalizePlanPosition(input.position) }
        : {}),
      node,
    };
  }

  if (input.kind === 'move-node') {
    if (typeof input.nodeId !== 'string' || input.nodeId.trim().length === 0) {
      return null;
    }

    return {
      kind: 'move-node',
      nodeId: input.nodeId,
      ...(typeof input.parentId === 'string' ? { parentId: input.parentId } : {}),
      ...(input.parentId === null ? { parentId: null } : {}),
      ...(normalizePlanPosition(input.position)
        ? { position: normalizePlanPosition(input.position) }
        : {}),
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

function bumpVersion(version: string): string {
  const asInt = Number(version);
  if (Number.isInteger(asInt) && String(asInt) === version) {
    return String(asInt + 1);
  }

  const suffixed = version.match(/^(.*?)(\d+)$/);
  if (suffixed) {
    return `${suffixed[1]}${Number(suffixed[2]) + 1}`;
  }

  return `${version}-next`;
}

export function applyPatchPlanToView(
  currentView: ViewDefinition,
  plan: ViewPatchPlan
): ViewDefinition | null {
  if (plan.mode !== 'patch' || plan.operations.length === 0) {
    return null;
  }

  let nextView = structuredClone(currentView);
  let changed = false;

  for (const rawOperation of plan.operations) {
    const operation = normalizePlanOperation(rawOperation);
    if (!operation) {
      return null;
    }

    try {
      const result = applyContinuumViewStreamPart({
        currentView: nextView,
        part: operation,
      });
      nextView = result.view;
      changed = true;
    } catch {
      return null;
    }
  }

  if (!changed) {
    return null;
  }

  nextView.version = bumpVersion(currentView.version);
  return nextView;
}
