import type {
  DetachedFieldHint,
  PromptOutputContract,
} from '@continuum-dev/prompts';
import { SUPPORTED_NODE_TYPE_VALUES } from '../../view-guardrails/index.js';
import type { CompactPatchNode, PatchNodeHint } from '../types.js';

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
    'You help a user who is editing a live Continuum form in a web browser.',
    'The node index and compact tree describe the current UI they are looking at right now.',
    'Your job is to adjust that existing UI so it better matches what the user is asking for.',
    'Prefer small, stable, reversible structural edits that preserve the current workflow unless the request clearly implies broader change.',
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
    '- Requests like "add more", "make this shorter", "make it nicer", and "ask less" should usually stay local unless the existing UI clearly cannot support the request without a broader redesign.',
    '- If instruction implies a brand new or replacement workflow, choose mode="full" and fullStrategy="replace".',
    '- If instruction can still evolve the current workflow but patching is unsafe, choose mode="full" and fullStrategy="evolve".',
    '- Supported operation kinds are: insert-node, move-node, wrap-nodes, replace-node, remove-node, append-content.',
    '- insert-node adds one full node subtree at a parent or the top level. Include position to control placement: {beforeId, afterId, or index}.',
    '- move-node repositions one existing node within or across parents. Always include position to specify the target ordering: {beforeId, afterId, or index}. For "move to the top" use position:{index:0}. For "move after X" use position:{afterId:"x_id"}.',
    '- wrap-nodes wraps existing sibling nodes in a new group/row/grid container.',
    '- replace-node replaces one existing node with a complete valid replacement subtree. Identify the existing node with nodeId (aliases: id, targetId).',
    '- remove-node removes one existing node.',
    '- append-content is only for appending text to an existing presentation node. If content is being rewritten, use replace-node instead.',
    '- For property tweaks on an existing node, use replace-node with the complete updated node object. Do not invent a separate prop-level patch language.',
    '- Use only node ids and parent ids that exist in the provided node index/tree unless you are introducing a brand-new inserted node.',
    '- Prefer the smallest valid operation list that satisfies the request.',
    '- Preserve semantic continuity and detached key continuity.',
    '- For layout-only regroupings, prefer move-node or wrap-nodes over replacing a large subtree.',
    '- For stateful fields that move structurally, preserve semanticKey and keep the same field id whenever possible.',
    '- If user asks to re-add a previously detached field, reuse its detached key as node key.',
    '- Detached field metadata is runtime continuity context only. Do not use previousLabel or previousParentLabel to decide where preserved values should go.',
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
  conversationSummary?: string;
}): string {
  return [
    `Current view (live browser UI the user is working on):\n${JSON.stringify(
      {
        viewId: args.viewId,
        version: args.version,
      },
      null,
      2
    )}`,
    'You are adjusting this current UI, not designing an abstract schema from scratch.',
    'The node index lists existing ids, keys, labels, and structural hints. Use it to target existing nodes precisely.',
    `Node index:\n${JSON.stringify(args.nodeHints, null, 2)}`,
    'The compact tree shows the full current hierarchy. When you replace or insert a collection, include a complete collection node with a valid template subtree and any needed defaultValues.',
    `Compact full tree snapshot:\n${JSON.stringify(args.compactTree, null, 2)}`,
    'Detached fields are prior removed fields available for runtime continuity only. Do not decide restore targets from previousLabel or previousParentLabel.',
    `Detached fields:\n${
      args.detachedFields.length > 0
        ? JSON.stringify(args.detachedFields, null, 2)
        : 'none'
    }`,
    ...(typeof args.conversationSummary === 'string' &&
    args.conversationSummary.trim().length > 0
      ? [
          'Recent conversation summary (bounded):',
          args.conversationSummary.trim(),
        ]
      : []),
    `Instruction:\n${args.instruction.trim()}`,
  ].join('\n\n');
}
