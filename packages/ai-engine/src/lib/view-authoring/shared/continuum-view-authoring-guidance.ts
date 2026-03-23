import type { PromptAddon, PromptMode } from '@continuum-dev/prompts';

function uniqueAddons(addons: PromptAddon[] = []): PromptAddon[] {
  return Array.from(new Set(addons));
}

export const CONTINUUM_PRODUCT_CONTEXT_HEADER = 'Continuum product context:';

export function continuumProductContextFirstBullet(
  format: 'line-dsl' | 'yaml' | 'view-json'
): string {
  switch (format) {
    case 'line-dsl':
      return '- The output you write becomes the UI a user sees in a live browser session.';
    case 'yaml':
      return '- The yaml you return becomes the UI a user sees in a live browser session.';
    case 'view-json':
      return '- The JSON object you return becomes the UI a user sees in a live browser session.';
    default: {
      const _exhaustive: never = format;
      return _exhaustive;
    }
  }
}

export const CONTINUUM_PRODUCT_CONTEXT_TAIL_LINES = [
  '- When evolving or correcting a current view, treat the existing UI as the thing the user is already working with.',
  '- Your job is to help the user accomplish what they want on that current form while keeping the workflow stable unless broader change is clearly required.',
] as const;

export const CONTINUUM_LAYOUT_STRUCTURE_LINES = [
  'Use layout structure intentionally.',
  'Prefer group for major sections and semantic clustering.',
  'Do not create empty groups that only wrap one child without adding meaning.',
  'Use row for 2-3 short related fields that belong on one line, such as first/last name or city/state/zip.',
  'Use grid when there are 4 or more compact peer fields or card-like items that benefit from scanability.',
  'Do not put long text inputs or textarea nodes inside a row unless there is a clear reason.',
  'Prefer vertical stacking on mobile-sensitive or dense workflows.',
  'Use collection only for repeatable user-managed items.',
  'Keep collection item templates compact and easy to scan.',
  'Use select or radio-group when choices are constrained and known ahead of time.',
  'Use toggle for simple boolean questions.',
  'Use presentation sparingly for orientation, section help, or summaries.',
  'Prefer one clear primary action near the end of the form.',
  'Avoid overly deep nesting and avoid unnecessary containers.',
] as const;

export function buildYamlLayoutGuidanceLines(addons?: PromptAddon[]): string[] {
  const lines: string[] = [...CONTINUUM_LAYOUT_STRUCTURE_LINES];
  for (const addon of uniqueAddons(addons)) {
    if (addon === 'strict-continuity') {
      lines.push(
        'Preserve existing section structure, keys, and node types when semantics are unchanged.'
      );
    }
    if (addon === 'attachments') {
      lines.push(
        'When source material provides real values, populate defaultValue and defaultValues without changing good existing layout.'
      );
    }
  }
  return lines;
}

export function buildLineDslLayoutAddonTailLines(addons?: PromptAddon[]): string[] {
  const lines: string[] = [];
  for (const addon of uniqueAddons(addons)) {
    if (addon === 'strict-continuity') {
      lines.push(
        'Preserve semantic keys and node types when meaning is unchanged.'
      );
      lines.push('Do not remove fields unless the instruction requires it.');
    }
    if (addon === 'attachments') {
      lines.push(
        'When useful, include sensible defaultValue or defaultValues inferred from provided context.'
      );
    }
  }
  return lines;
}

export const CONTINUUM_DETACHED_FIELD_GUIDANCE_LINES = [
  'Detached fields are previously removed fields whose user data can still be restored by the runtime.',
  'Do not use previousLabel or previousParentLabel to decide where preserved values should go.',
  'If you reintroduce the same semantic field, reuse its detachedKey as the node key even if the label changes.',
  'Do not reuse a detachedKey for a different concept just because the value looks similar.',
] as const;

export function continuumModeGuidanceLine(mode: PromptMode): string {
  if (mode === 'create-view') {
    return 'Create a brand-new view from the user request.';
  }
  if (mode === 'correction-loop') {
    return 'Return a corrected next view that resolves the provided errors while preserving unchanged semantics and current workflow when possible.';
  }
  return 'Evolve the existing view instead of replacing it wholesale unless the instruction clearly requires a different workflow.';
}

export const CONTINUUM_PREFILL_VS_LAYOUT_LINE =
  'If the user asks to populate, prefill, or fill out the form, preserve the structure and add defaultValue/defaultValues instead of changing layout.';

function buildViewJsonNodeAndCollectionRuleLines(): string[] {
  return [
    'Supported node type values are: group, row, grid, collection, field, textarea, date, select, radio-group, slider, toggle, action, presentation.',
    'Every node object must include id.',
    'Use key when semantic continuity matters.',
    'Use semanticKey on every stateful node (field, textarea, date, select, radio-group, slider, toggle, collection). Use dotted domain notation like person.firstName, tax.filingStatus, order.lineItems.',
    'For field nodes, include dataType string, number, or boolean.',
    'To prefill a scalar node, use defaultValue. Never use value.',
    'For presentation nodes, include contentType text or markdown and content.',
    'For action nodes, include intentId and label.',
    'For grid nodes, you may include columns.',
    'For group nodes, you may include layout vertical, horizontal, or grid and columns.',
    'For slider nodes, include min and max and optional step.',
    'For select and radio-group nodes, include options as objects with value and label.',
    'For collection nodes, template must be exactly one child ViewNode subtree.',
    'To prefill a collection, set defaultValues as an array of objects on the collection node.',
    'If you create or keep a collection, give it at least one initial item via defaultValues unless the user explicitly asks for an empty collection.',
    'A collection template must be a real node subtree, usually a group, row, or grid containing the repeatable fields.',
    'Do not create a collection with an empty template or a template that has no actual child fields.',
    'Do not put action nodes directly inside collection templates unless the user explicitly asks for item-level actions.',
    'Do not put defaultValue on template fields when your goal is to prefill collection items.',
    'Keep ids unique.',
    'Prefer simple, valid structures over complex ones.',
  ];
}

const VIEW_JSON_QUALITY_EXAMPLE = {
  viewId: 'profile_form',
  version: '4',
  nodes: [
    {
      id: 'profile_root',
      type: 'group',
      label: 'Profile',
      children: [
        {
          id: 'first_name',
          type: 'field',
          key: 'first_name',
          semanticKey: 'person.firstName',
          label: 'First name',
          dataType: 'string',
          defaultValue: 'Jane',
        },
        {
          id: 'newsletter',
          type: 'toggle',
          key: 'newsletter',
          semanticKey: 'person.newsletter',
          label: 'Subscribe',
          defaultValue: true,
        },
        {
          id: 'medications',
          type: 'collection',
          key: 'medications',
          semanticKey: 'person.medications',
          label: 'Medications',
          defaultValues: [{ medication_name: 'Lisinopril', medication_dose: '10mg' }],
          template: {
            id: 'medication_item',
            type: 'group',
            label: 'Medication',
            children: [
              {
                id: 'medication_name',
                type: 'field',
                key: 'medication_name',
                semanticKey: 'medication.name',
                label: 'Medication name',
                dataType: 'string',
              },
              {
                id: 'medication_dose',
                type: 'field',
                key: 'medication_dose',
                semanticKey: 'medication.dose',
                label: 'Dose',
                dataType: 'string',
              },
            ],
          },
        },
      ],
    },
  ],
};

export function buildViewJsonAuthoringExtension(args: {
  mode: PromptMode;
  addons?: PromptAddon[];
}): string {
  const sections = [
    '<continuum_view_authoring>',
    CONTINUUM_PRODUCT_CONTEXT_HEADER,
    continuumProductContextFirstBullet('view-json'),
    ...CONTINUUM_PRODUCT_CONTEXT_TAIL_LINES,
    'The following Continuum rules apply in addition to the output contract schema.',
    ...buildViewJsonNodeAndCollectionRuleLines(),
    ...CONTINUUM_LAYOUT_STRUCTURE_LINES,
    ...buildLineDslLayoutAddonTailLines(args.addons),
    ...CONTINUUM_DETACHED_FIELD_GUIDANCE_LINES,
    continuumModeGuidanceLine(args.mode),
    CONTINUUM_PREFILL_VS_LAYOUT_LINE,
    '</continuum_view_authoring>',
    '<example>',
    JSON.stringify(VIEW_JSON_QUALITY_EXAMPLE, null, 2),
    '</example>',
  ];
  return sections.join('\n');
}
