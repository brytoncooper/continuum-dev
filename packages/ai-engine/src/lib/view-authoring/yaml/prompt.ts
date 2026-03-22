import type { PromptAddon, PromptMode } from '@continuum-dev/prompts';
import { uniqueAddons } from './shared.js';

function buildLayoutGuidance(addons?: PromptAddon[]): string[] {
  const lines = [
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
  ];

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

export function buildViewYamlSystemPrompt(args: {
  mode: PromptMode;
  addons?: PromptAddon[];
}): string {
  const sections = [
    '<instructions>',
    'Continuum product context:',
    '- The yaml you return becomes the UI a user sees in a live browser session.',
    '- When evolving or correcting a current view, treat the existing UI as the thing the user is already working with.',
    '- Your job is to help the user accomplish what they want on that current form while keeping the workflow stable unless broader change is clearly required.',
    'Return exactly one markdown code block with language yaml.',
    'Do not include prose before or after the code block.',
    'The yaml must represent one full Continuum ViewDefinition object.',
    'Use these top-level keys: viewId, version, nodes.',
    'Supported node types are: group, row, grid, collection, field, textarea, date, select, radio-group, slider, toggle, action, presentation.',
    'Every node must include id and type.',
    'Use key when semantic continuity matters.',
    'For field nodes, include dataType: string | number | boolean.',
    'To prefill a scalar node, use defaultValue. Never use value.',
    'For presentation nodes, include contentType: text | markdown and content.',
    'For action nodes, include intentId and label.',
    'For grid nodes, you may include columns.',
    'For group nodes, you may include layout: vertical | horizontal | grid and columns.',
    'For slider nodes, include min and max and optional step.',
    'For select and radio-group nodes, include options as yaml objects with value and label.',
    'For collection nodes, include a valid template node.',
    'To prefill a collection, set defaultValues as a yaml array of objects on the collection node.',
    'If you create or keep a collection, give it at least one initial item via defaultValues unless the user explicitly asks for an empty collection.',
    'A collection template must be a real node subtree, usually a group, row, or grid containing the repeatable fields.',
    'Do not create a collection with an empty template or a template that has no actual child fields.',
    'Do not put action nodes directly inside collection templates unless the user explicitly asks for item-level actions.',
    'Do not put defaultValue on template fields when your goal is to prefill collection items.',
    'Keep ids unique.',
    'Prefer simple, valid structures over complex ones.',
    ...buildLayoutGuidance(args.addons),
    'Detached fields are previously removed fields whose user data can still be restored by the runtime.',
    'Do not use previousLabel or previousParentLabel to decide where preserved values should go.',
    'If you reintroduce the same semantic field, reuse its detachedKey as the node key even if the label changes.',
    'Do not reuse a detachedKey for a different concept just because the value looks similar.',
    args.mode === 'create-view'
      ? 'Create a brand-new view from the user request.'
      : args.mode === 'correction-loop'
        ? 'Return a corrected next view that resolves the provided errors while preserving unchanged semantics and current workflow when possible.'
        : 'Evolve the existing view instead of replacing it wholesale unless the instruction clearly requires a different workflow.',
    'If the user asks to populate, prefill, or fill out the form, preserve the structure and add defaultValue/defaultValues instead of changing layout.',
    '</instructions>',
    '<example>',
    '```yaml',
    'viewId: patient_checkin',
    'version: "2"',
    'nodes:',
    '  - id: checkin',
    '    type: group',
    '    label: Urgent Care Check-In',
    '    children:',
    '      - id: full_name',
    '        type: field',
    '        key: full_name',
    '        label: Full name',
    '        dataType: string',
    '      - id: contact_row',
    '        type: row',
    '        children:',
    '          - id: phone',
    '            type: field',
    '            key: phone',
    '            label: Phone',
    '            dataType: string',
    '          - id: birth_date',
    '            type: date',
    '            key: birth_date',
    '            label: Date of birth',
    '      - id: medications',
    '        type: collection',
    '        key: medications',
    '        label: Current medications',
    '        defaultValues:',
    '          - medication_name: Lisinopril',
    '        template:',
    '          id: medication_item',
    '          type: group',
    '          label: Medication',
    '          children:',
    '            - id: medication_name',
    '              type: field',
    '              key: medication_name',
    '              label: Medication name',
    '              dataType: string',
    '      - id: submit_checkin',
    '        type: action',
    '        intentId: submit_checkin.submit',
    '        label: Submit',
    '```',
    '</example>',
  ];

  return sections.join('\n');
}

export function buildViewYamlUserMessage(args: {
  mode: PromptMode;
  instruction: string;
  currentView?: unknown;
  detachedFields?: unknown[];
  conversationSummary?: string;
  validationErrors?: string[];
  runtimeErrors?: string[];
}): string {
  const sections = ['<input>'];

  sections.push(
    'Continuum context:\n' +
      '- The current view represents the live browser UI the user is working on.\n' +
      '- Your response becomes the next version of that UI.\n' +
      '- Keep the current workflow stable unless the instruction clearly asks for broader change.'
  );

  if (typeof args.currentView !== 'undefined') {
    sections.push(`Current view:\n${JSON.stringify(args.currentView, null, 2)}`);
  }

  if (
    typeof args.conversationSummary === 'string' &&
    args.conversationSummary.trim().length > 0
  ) {
    sections.push(
      'Recent conversation summary (bounded):\n' + args.conversationSummary.trim()
    );
  }

  if (Array.isArray(args.detachedFields)) {
    sections.push(
      'Detached fields are prior removed fields available for runtime continuity only. Do not use previousLabel or previousParentLabel to infer restore targets.\n' +
        `Detached fields:\n${
          args.detachedFields.length > 0
            ? JSON.stringify(args.detachedFields, null, 2)
            : 'none'
        }`
    );
  }

  if (
    args.mode === 'correction-loop' &&
    Array.isArray(args.validationErrors) &&
    Array.isArray(args.runtimeErrors)
  ) {
    sections.push(
      `Validation errors:\n${
        args.validationErrors.length > 0
          ? args.validationErrors.join('\n')
          : 'none'
      }`
    );
    sections.push(
      `Runtime errors:\n${
        args.runtimeErrors.length > 0 ? args.runtimeErrors.join('\n') : 'none'
      }`
    );
  }

  sections.push(`Instruction:\n${args.instruction.trim()}`);
  sections.push(
    'Output format:\nReturn exactly one ```yaml fenced block containing the full next ViewDefinition.'
  );
  sections.push('</input>');

  return sections.join('\n\n');
}
