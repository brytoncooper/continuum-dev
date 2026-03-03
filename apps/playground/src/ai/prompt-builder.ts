import type { ViewDefinition } from '@continuum/contract';
import type { ReconciliationIssue, ReconciliationResolution } from '@continuum/runtime';
import type { ChatMessage, AIAttachment } from './types';

const SYSTEM_PROMPT = `You generate Continuum ViewDefinition JSON.

Return only valid JSON with this shape:
{
  "viewId": "<stable view identifier>",
  "version": "<string version that changes when the view changes>",
  "nodes": [
    {
      "id": "<unique node id>",
      "type": "<field|group|collection|action|presentation>",
      "key": "<stable semantic key>"
    }
  ]
}

Rules:
- Keep viewId stable for the same logical view.
- Increment version whenever the view structure changes.
- Keep id unique within the full tree.
- Keep key stable across versions when semantic meaning is unchanged.
- Never rename or remove existing collection keys unless the user explicitly asks to split, remove, or restructure collections.
- Use any UI structure you think fits the user request.

Supported playground node types (prefer these):
- field: text/number/boolean input. Requires dataType: string | number | boolean.
- textarea: multiline string input.
- date: date input (value format YYYY-MM-DD string).
- select: single-choice dropdown, include options: [{ value, label }].
- radio-group: single-choice radio options, include options: [{ value, label }].
- slider: numeric range input, include props: { min, max }.
- toggle: boolean switch.
- action: button, requires intentId and label.
- group: container, requires children: ViewNode[].
- row: horizontal layout container to place fields side-by-side, requires children: ViewNode[].
- grid: grid layout container, requires children: ViewNode[]. Can specify columns: number (default 2).
- collection: repeatable group, requires template: ViewNode.
- presentation: static text/markdown, requires contentType and content.

General guidance:
- You are not limited to one form layout; choose the structure that best matches the prompt.
- Keep date-like fields as type "date" when appropriate.
- Include labels/placeholders when helpful.
- For collections that should start prefilled, include \`defaultValues\` on the collection node as an array.
- If collection template is a simple field/select/radio-group, \`defaultValues\` can be scalar values.
- If collection template is a group, each \`defaultValues\` entry should be an object keyed by child key/id.
- Return JSON only.

IMPORTANT – Populating data:
- When the user provides a document, image, or any data source (attachment or in-prompt), you MUST extract the actual data and set \`defaultValue\` on every field/textarea/date/select node where you can determine a value.
- Do NOT just put extracted data in \`placeholder\`. Use \`defaultValue\` to actually populate the form with real data.
- \`placeholder\` is only for hint text when there is no known value. \`defaultValue\` is the actual pre-filled value.
- For date fields, set \`defaultValue\` as a YYYY-MM-DD string.
- For select fields, set \`defaultValue\` to one of the option values.
- For collections, populate \`defaultValues\` with an array of objects containing every line item from the source data.`;

export interface BuildMessagesArgs {
  prompt: string;
  currentView?: ViewDefinition;
  attachments?: AIAttachment[];
}

export function buildInitialMessages(prompt: string, attachments?: AIAttachment[]): ChatMessage[] {
  return [{ role: 'user', content: prompt.trim(), attachments }];
}

export function buildEvolutionMessages(prompt: string, currentView: ViewDefinition, attachments?: AIAttachment[]): ChatMessage[] {
  return [
    {
      role: 'user',
      content: `Current view:\n${JSON.stringify(currentView, null, 2)}\n\nInstruction:\n${prompt.trim()}`,
      attachments,
    },
  ];
}

export function buildCorrectionMessages(args: {
  prompt: string;
  currentView: ViewDefinition;
  validationErrors: string[];
  issues: ReconciliationIssue[];
  resolutions: ReconciliationResolution[];
  attachments?: AIAttachment[];
}): ChatMessage[] {
  const detachedNodeIds = args.resolutions
    .filter((resolution) => resolution.resolution === 'detached')
    .map((resolution) => resolution.nodeId);
  const runtimeErrors = args.issues
    .filter((issue) => issue.severity === 'error')
    .map((issue) => `${issue.code}${issue.nodeId ? `:${issue.nodeId}` : ''}`);

  return [
    {
      role: 'user',
      content: [
        `Current view:\n${JSON.stringify(args.currentView, null, 2)}`,
        `Original instruction:\n${args.prompt.trim()}`,
        `Validation errors:\n${args.validationErrors.length > 0 ? args.validationErrors.join('\n') : 'none'}`,
        `Detached node ids:\n${detachedNodeIds.length > 0 ? detachedNodeIds.join(', ') : 'none'}`,
        `Runtime errors:\n${runtimeErrors.length > 0 ? runtimeErrors.join(', ') : 'none'}`,
        'Regenerate a corrected view. Preserve semantic keys for unchanged meaning.',
      ].join('\n\n'),
      attachments: args.attachments,
    },
  ];
}

export function getSystemPrompt(): string {
  return SYSTEM_PROMPT;
}
