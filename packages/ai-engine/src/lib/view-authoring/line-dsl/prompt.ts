import type { PromptAddon, PromptMode } from '@continuum-dev/prompts';

function uniqueAddons(addons: PromptAddon[] = []): PromptAddon[] {
  return Array.from(new Set(addons));
}

export function buildViewLineDslSystemPrompt(args: {
  mode: PromptMode;
  addons?: PromptAddon[];
}): string {
  const sections = [
    '<instructions>',
    'Continuum product context:',
    '- The output you write becomes the UI a user sees in a live browser session.',
    '- When evolving or correcting a current view, treat the existing UI as the thing the user is already working with.',
    '- Your job is to help the user accomplish what they want on that current form while keeping the workflow stable unless broader change is clearly required.',
    'Return only Continuum View DSL.',
    'Do not return JSON.',
    'Do not return markdown fences.',
    'Use exactly two spaces for each indentation level.',
    'Write exactly one root line followed by one line per node.',
    'The root line format is: view viewId="..." version="..."',
    'Supported node types are: group, row, grid, collection, field, textarea, date, select, radio-group, slider, toggle, action, presentation.',
    'Every node line must include id="...".',
    'Use key="..." when semantic continuity matters.',
    'Use semanticKey="domain.field" on every stateful node (field, textarea, date, select, radio-group, slider, toggle, collection). Use dotted domain notation like person.firstName, tax.filingStatus, order.lineItems.',
    'For field nodes, include dataType="string|number|boolean".',
    'To prefill a scalar node, use defaultValue="...". Never use value="...".',
    'For presentation nodes, include contentType="text|markdown" and content="...".',
    'For action nodes, include intentId="..." and label="...".',
    'For grid nodes, you may include columns=2.',
    'For group nodes, you may include layout="vertical|horizontal|grid" and columns=2.',
    'For slider nodes, include min=0 max=10 and optional step=1.',
    'For select and radio-group nodes, encode options as options="value1:Label 1|value2:Label 2".',
    'For collection nodes, indent exactly one child node under the collection. That child is the template.',
    'To prefill a collection, set defaultValues="[{"field_key":"value"}]" on the collection node.',
    'If you create or keep a collection, give it at least one initial item via defaultValues unless the user explicitly asks for an empty collection.',
    'A collection template must be a real node subtree, usually a group, row, or grid containing the repeatable fields.',
    'Do not create a collection with an empty template or a template that has no actual child fields.',
    'Do not put action nodes directly inside collection templates unless the user explicitly asks for item-level actions.',
    'Do not put value/defaultValue on template fields when your goal is to prefill collection items.',
    'Keep ids unique.',
    'Prefer simple, valid structures over complex ones.',
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
  ];

  for (const addon of uniqueAddons(args.addons)) {
    if (addon === 'strict-continuity') {
      sections.push(
        'Preserve semantic keys and node types when meaning is unchanged.'
      );
      sections.push('Do not remove fields unless the instruction requires it.');
    }

    if (addon === 'attachments') {
      sections.push(
        'When useful, include sensible defaultValue or defaultValues inferred from provided context.'
      );
    }
  }

  sections.push('</instructions>');
  sections.push('<example>');
  sections.push('view viewId="patient_checkin" version="2"');
  sections.push('group id="checkin" label="Urgent Care Check-In"');
  sections.push(
    '  field id="full_name" key="full_name" semanticKey="patient.fullName" label="Full name" dataType="string"'
  );
  sections.push('  row id="contact_row"');
  sections.push(
    '    field id="phone" key="phone" semanticKey="patient.phone" label="Phone" dataType="string"'
  );
  sections.push(
    '    date id="birth_date" key="birth_date" semanticKey="patient.birthDate" label="Date of birth"'
  );
  sections.push(
    '  collection id="medications" key="medications" semanticKey="patient.medications" label="Current medications" defaultValues="[{\\"medication_name\\":\\"Lisinopril\\"}]"'
  );
  sections.push('    group id="medication_item" label="Medication"');
  sections.push(
    '      field id="medication_name" key="medication_name" semanticKey="medication.name" label="Medication name" dataType="string"'
  );
  sections.push(
    '      field id="medication_dose" key="medication_dose" semanticKey="medication.dose" label="Dose" dataType="string"'
  );
  sections.push(
    '  action id="submit_checkin" intentId="submit_checkin.submit" label="Submit"'
  );
  sections.push('</example>');
  sections.push('<example>');
  sections.push('view viewId="profile_form" version="4"');
  sections.push('group id="profile_root" label="Profile"');
  sections.push(
    '  field id="first_name" key="first_name" semanticKey="person.firstName" label="First name" dataType="string" defaultValue="Jane"'
  );
  sections.push(
    '  toggle id="newsletter" key="newsletter" semanticKey="person.newsletter" label="Subscribe" defaultValue=true'
  );
  sections.push(
    '  collection id="medications" key="medications" semanticKey="person.medications" label="Medications" defaultValues="[{\\"medication_name\\":\\"Lisinopril\\",\\"medication_dose\\":\\"10mg\\"}]"'
  );
  sections.push('    group id="medication_item" label="Medication"');
  sections.push(
    '      field id="medication_name" key="medication_name" semanticKey="medication.name" label="Medication name" dataType="string"'
  );
  sections.push(
    '      field id="medication_dose" key="medication_dose" semanticKey="medication.dose" label="Dose" dataType="string"'
  );
  sections.push('</example>');

  return sections.join('\n');
}

export function buildViewLineDslUserMessage(args: {
  mode: PromptMode;
  instruction: string;
  currentView?: unknown;
  detachedFields?: unknown[];
  conversationSummary?: string;
  validationErrors?: string[];
  runtimeErrors?: string[];
  integrationBinding?: string;
}): string {
  const sections = ['<input>'];

  const integrationBindingText =
    typeof args.integrationBinding === 'string'
      ? args.integrationBinding.trim()
      : '';

  sections.push(
    'Continuum context:\n' +
      '- The current view represents the live browser UI the user is working on.\n' +
      '- Your response becomes the next version of that UI.\n' +
      '- Keep the current workflow stable unless the instruction clearly asks for broader change.' +
      (integrationBindingText.length > 0
        ? '\n- A backend integration contract is included below: every persisted field semantic key must stay within that single endpoint schema.'
        : '')
  );

  if (typeof args.currentView !== 'undefined') {
    sections.push(
      `Current view:\n${JSON.stringify(args.currentView, null, 2)}`
    );
  }

  if (
    typeof args.conversationSummary === 'string' &&
    args.conversationSummary.trim().length > 0
  ) {
    sections.push(
      'Recent conversation summary (bounded):\n' +
        args.conversationSummary.trim()
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

  if (integrationBindingText.length > 0) {
    sections.push(integrationBindingText);
  }

  sections.push(`Instruction:\n${args.instruction.trim()}`);
  sections.push('Output format:\nReturn only Continuum View DSL.');
  sections.push('</input>');

  return sections.join('\n\n');
}
