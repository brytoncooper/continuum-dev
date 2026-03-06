import type {
  AssembleSystemPromptArgs,
  BuildUserMessageArgs,
  PromptAddon,
  PromptLibrary,
  PromptMode,
} from './types.js';

export const PROMPT_LIBRARY_VERSION = '2026-03-06.1';

export const SYSTEM_CORE = `You generate Continuum ViewDefinition JSON.

Output requirements:
- Return JSON only (no markdown, no commentary).
- Top-level shape:
  {
    "viewId": string,
    "version": string,
    "nodes": ViewNode[]
  }

Core continuity rules:
- Keep viewId stable for the same logical workflow.
- Change version when structure changes.
- Keep node ids unique in the full tree.
- Keep semantic keys stable across versions when meaning is unchanged.
- Preserve unchanged semantics whenever possible.

Rendering constraints:
- Only use node types that this app explicitly supports.
- Include required fields for each node type.
- For option-based nodes, include options as [{ "value": string, "label": string }].
- For collection nodes, include a valid template node.`;

export const MODE_CREATE_VIEW = `Mode: Create a brand-new view from user intent.

Guidance:
- Optimize for clarity and completion of the user task.
- Choose a layout that fits the task and data complexity.
- Include labels and sensible defaults when helpful.
- Prefer semantic keys that remain meaningful in future versions.

For this app, supported node types are:
- field (requires dataType: string | number | boolean)
- textarea
- date
- select (requires options)
- radio-group (requires options)
- slider (requires min and max)
- toggle
- action (requires intentId and label)
- group (requires children)
- row (requires children)
- grid (requires children, optional columns)
- collection (requires template, optional defaultValues)
- presentation (requires contentType and content)

If uncertain:
- Use simple, explicit structures first.
- Avoid creating deeply nested trees unless clearly beneficial.`;

export const MODE_EVOLVE_VIEW = `Mode: Evolve an existing view.

Input context will include:
- currentView JSON
- user instruction describing changes

Guidance:
- Evolve currentView instead of regenerating from scratch.
- Preserve semantic continuity when meaning is unchanged.
- Keep stable keys for unchanged semantics.
- You may restructure layout containers when useful.
- If semantics change, update key/type intentionally and clearly.

Continuity preferences:
- Preserve existing node ids when possible.
- If id changes, keep key stable when semantics are unchanged.
- Avoid unnecessary key churn.

Output:
- Full next ViewDefinition JSON.`;

export const MODE_CORRECTION_LOOP = `Mode: Correct a rejected or problematic view.

Input context will include:
- currentView JSON
- original instruction
- validation errors
- runtime errors
- detached node ids (if any)

Correction goals:
- Resolve all listed validation and runtime errors.
- Preserve semantic keys for unchanged fields.
- Avoid duplicate ids and duplicate scoped keys.
- Reduce detached outcomes unless semantics truly changed.

Output requirements:
- Return a corrected full ViewDefinition.
- Keep only relevant structural changes needed to resolve errors.`;

export const ADDON_ATTACHMENTS = `Attachment extraction addon.

When attachments (documents/images) are present:
- Extract known values and populate defaultValue/defaultValues when confidence is high.
- Do not invent uncertain values.
- Use placeholder as hint text only, not as extracted data storage.

Field-specific rules:
- date values should be YYYY-MM-DD.
- select/radio-group defaultValue should be one of the option values.
- collection defaultValues should include one entry per extracted line item.`;

export const ADDON_STRICT_CONTINUITY = `Strict continuity addon.

Apply stronger bias toward continuity:
- Do not change keys for unchanged semantic meaning.
- Do not change node type for unchanged semantic meaning.
- Do not remove existing fields unless the user explicitly requests removal.
- Do not split or merge collections unless explicitly requested.

Allowed flexibility:
- Layout container changes are allowed when semantics are preserved.
- New fields can be added when clearly requested or required.`;

export const EXAMPLE_CREATE_VIEW_USER_MESSAGE = `Create a mortgage intake form for first-time home buyers.

Requirements:
- Capture borrower identity, contact info, employment, income, assets, liabilities.
- Include a co-borrower section that can stay hidden until user enables it.
- Include a collection for liabilities with creditor, balance, monthlyPayment.
- Include one action node for "submit_prequal".

Keep the structure understandable for non-technical users.`;

export const EXAMPLE_EVOLVE_VIEW_USER_MESSAGE = `Current view is provided.

Please evolve it with these changes:
- Add a co-borrower employment subsection.
- Add a date field for lease_end_date in housing details.
- Keep all existing semantic keys for unchanged meaning.
- Keep action intent ids unchanged.

You may adjust layout containers if needed.`;

export const EXAMPLE_CORRECTION_LOOP_USER_MESSAGE = `Current view and diagnostics are provided.

Regenerate a corrected full view that:
- resolves all validation errors
- resolves runtime errors
- avoids duplicate ids and duplicate scoped keys
- preserves semantic keys and node types for unchanged meaning

Do not make unrelated structural changes.`;

export const PROMPT_LIBRARY: PromptLibrary = {
  version: PROMPT_LIBRARY_VERSION,
  base: SYSTEM_CORE,
  modes: {
    'create-view': MODE_CREATE_VIEW,
    'evolve-view': MODE_EVOLVE_VIEW,
    'correction-loop': MODE_CORRECTION_LOOP,
  },
  addons: {
    attachments: ADDON_ATTACHMENTS,
    'strict-continuity': ADDON_STRICT_CONTINUITY,
  },
};

function uniqueAddons(addons: PromptAddon[] = []): PromptAddon[] {
  return Array.from(new Set(addons));
}

export function assembleSystemPrompt(args: AssembleSystemPromptArgs): string {
  const sections = [PROMPT_LIBRARY.base, PROMPT_LIBRARY.modes[args.mode]];
  for (const addon of uniqueAddons(args.addons)) {
    sections.push(PROMPT_LIBRARY.addons[addon]);
  }
  return sections.join('\n\n');
}

export function buildCreateUserMessage(instruction: string): string {
  return instruction.trim();
}

export function buildEvolveUserMessage(args: BuildUserMessageArgs): string {
  if (typeof args.currentView === 'undefined') {
    throw new Error('buildEvolveUserMessage requires currentView');
  }

  return [
    `Current view:\n${JSON.stringify(args.currentView, null, 2)}`,
    `Instruction:\n${args.instruction.trim()}`,
  ].join('\n\n');
}

export function buildCorrectionUserMessage(args: BuildUserMessageArgs): string {
  if (typeof args.currentView === 'undefined') {
    throw new Error('buildCorrectionUserMessage requires currentView');
  }

  const validationErrors = args.validationErrors ?? [];
  const runtimeErrors = args.runtimeErrors ?? [];
  const detachedNodeIds = args.detachedNodeIds ?? [];

  return [
    `Current view:\n${JSON.stringify(args.currentView, null, 2)}`,
    `Instruction:\n${args.instruction.trim()}`,
    `Validation errors:\n${validationErrors.length > 0 ? validationErrors.join('\n') : 'none'}`,
    `Runtime errors:\n${runtimeErrors.length > 0 ? runtimeErrors.join(', ') : 'none'}`,
    `Detached node ids:\n${detachedNodeIds.length > 0 ? detachedNodeIds.join(', ') : 'none'}`,
  ].join('\n\n');
}

export function getModePrompt(mode: PromptMode): string {
  return PROMPT_LIBRARY.modes[mode];
}

export function getAddonPrompt(addon: PromptAddon): string {
  return PROMPT_LIBRARY.addons[addon];
}
