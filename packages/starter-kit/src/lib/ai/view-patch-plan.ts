import type { ViewDefinition } from '@continuum-dev/core';
import type {
  DetachedFieldHint,
  PromptOutputContract,
} from '@continuum-dev/prompts';
import type {
  CompactPatchNode,
  PatchNodeHint,
} from './patch-context.js';

export interface ViewPatchTarget {
  id?: string;
  key?: string;
  path?: string;
}

export interface ViewPatchOperation {
  op: 'set-prop';
  target: ViewPatchTarget;
  prop: string;
  value?: unknown;
}

export interface ViewPatchPlan {
  mode: 'patch' | 'full';
  operations: ViewPatchOperation[];
  reason?: string;
  fullStrategy?: 'evolve' | 'replace';
}

const PATCHABLE_NODE_PROPS = new Set([
  'type',
  'key',
  'label',
  'description',
  'placeholder',
  'defaultValue',
  'defaultValues',
  'dataType',
  'contentType',
  'content',
  'intentId',
  'options',
  'min',
  'max',
  'step',
  'columns',
  'layout',
  'children',
  'template',
]);

const JSON_VALUE_SCHEMA = {
  type: ['string', 'number', 'boolean', 'object', 'array', 'null'],
};

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
          required: ['op', 'target', 'prop'],
          properties: {
            op: { type: 'string' },
            target: {
              type: 'object',
              additionalProperties: false,
              properties: {
                id: { type: 'string' },
                key: { type: 'string' },
                path: { type: 'string' },
              },
            },
            prop: { type: 'string' },
            value: JSON_VALUE_SCHEMA,
          },
        },
      },
    },
  },
};

export function buildPatchSystemPrompt(): string {
  return [
    'You generate Continuum patch plans, not full views.',
    'Return JSON only.',
    'Do not wrap the JSON in markdown fences.',
    'Do not include commentary before or after the JSON.',
    'Mode options:',
    '- mode="patch": return operations for small updates.',
    '- mode="full": return no operations when patching is unsafe or ambiguous.',
    '- When mode="full", include fullStrategy as either "evolve" or "replace".',
    'Rules:',
    '- Prefer mode="patch" when updating existing node props.',
    '- If instruction implies a brand new or replacement workflow, choose mode="full" and fullStrategy="replace".',
    '- If instruction can still evolve the current workflow but patching is unsafe, choose mode="full" and fullStrategy="evolve".',
    '- Use op "set-prop" only.',
    '- set-prop may update local structure, including type/columns/layout/children/template.',
    '- If you add or keep a collection, ensure it starts with at least one item via defaultValues unless the user explicitly asks for an empty collection.',
    '- Prefer local container patches for layout tweaks instead of forcing full mode.',
    '- When setting children or template, provide complete valid Continuum node objects.',
    '- Use target.path whenever possible.',
    '- Use only targets present in the provided node index.',
    '- Preserve semantic continuity and detached key continuity.',
    '- If user asks to re-add a previously detached field, reuse its detached key as node key.',
    '- Use previousLabel and previousParentLabel on detached fields as semantic clues for restore requests.',
    '- Do not reuse a detachedKey for a different concept just because the value preview looks similar.',
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
    `Node index:\n${JSON.stringify(args.nodeHints, null, 2)}`,
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

interface MutableNodeRef {
  path: string;
  id: string;
  key?: string;
  node: Record<string, unknown>;
}

function collectMutableNodeRefs(view: ViewDefinition): MutableNodeRef[] {
  const refs: MutableNodeRef[] = [];

  const walk = (nodes: unknown[], parentPath: string): void => {
    for (const node of nodes) {
      if (!node || typeof node !== 'object') {
        continue;
      }

      const asRecord = node as Record<string, unknown>;
      const id =
        typeof asRecord.id === 'string' && asRecord.id.length > 0
          ? asRecord.id
          : 'node';
      const path = parentPath.length > 0 ? `${parentPath}/${id}` : id;
      refs.push({
        path,
        id,
        key: typeof asRecord.key === 'string' ? asRecord.key : undefined,
        node: asRecord,
      });

      if (Array.isArray(asRecord.children)) {
        walk(asRecord.children, path);
      }

      if (asRecord.template && typeof asRecord.template === 'object') {
        walk([asRecord.template], path);
      }
    }
  };

  walk(view.nodes as unknown[], '');
  return refs;
}

function resolvePatchTarget(
  refs: MutableNodeRef[],
  target: ViewPatchTarget
): MutableNodeRef | null {
  const matches = refs.filter((ref) => {
    if (target.path) {
      return ref.path === target.path;
    }
    if (target.key) {
      return ref.key === target.key;
    }
    if (target.id) {
      return ref.id === target.id;
    }
    return false;
  });

  if (matches.length !== 1) {
    return null;
  }
  return matches[0];
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

  const nextView = structuredClone(currentView);
  const refs = collectMutableNodeRefs(nextView);
  let changed = false;

  for (const operation of plan.operations) {
    if (
      !operation ||
      operation.op !== 'set-prop' ||
      !operation.target ||
      typeof operation.prop !== 'string'
    ) {
      return null;
    }

    if (!PATCHABLE_NODE_PROPS.has(operation.prop)) {
      return null;
    }

    const ref = resolvePatchTarget(refs, operation.target);
    if (!ref) {
      return null;
    }

    const currentValue = ref.node[operation.prop];
    if (Object.is(currentValue, operation.value)) {
      continue;
    }

    if (typeof operation.value === 'undefined') {
      delete ref.node[operation.prop];
    } else {
      ref.node[operation.prop] = operation.value;
    }
    changed = true;
  }

  if (!changed) {
    return null;
  }

  nextView.version = bumpVersion(currentView.version);
  return nextView;
}
