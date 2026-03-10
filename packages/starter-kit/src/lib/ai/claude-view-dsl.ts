import type { ViewDefinition } from '@continuum-dev/core';
import type { PromptAddon, PromptMode } from '@continuum-dev/prompts';
import { parseJson } from './view-guardrails.js';

type DslNodeType =
  | 'field'
  | 'textarea'
  | 'date'
  | 'select'
  | 'radio-group'
  | 'slider'
  | 'toggle'
  | 'action'
  | 'group'
  | 'row'
  | 'grid'
  | 'collection'
  | 'presentation';

interface DslNode {
  type: DslNodeType;
  attrs: Record<string, string>;
  children: DslNode[];
}

const CONTAINER_TYPES = new Set<DslNodeType>([
  'group',
  'row',
  'grid',
  'collection',
]);

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

function uniqueAddons(addons: PromptAddon[] = []): PromptAddon[] {
  return Array.from(new Set(addons));
}

function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith('```')) {
    return trimmed;
  }

  const lines = trimmed.split(/\r?\n/);
  if (lines.length >= 2 && lines[0].startsWith('```')) {
    lines.shift();
  }
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
    lines.pop();
  }
  if (lines.length > 0 && lines[lines.length - 1].startsWith('```')) {
    lines.pop();
  }
  return lines.join('\n').trim();
}

function normalizeDslText(text: string): string {
  const stripped = stripCodeFences(text);
  const lines = stripped.split(/\r?\n/);
  const startIndex = lines.findIndex((line) => line.trim().startsWith('view '));
  return (startIndex >= 0 ? lines.slice(startIndex) : lines)
    .join('\n')
    .trim();
}

function parseAttrs(input: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const regex = /([a-zA-Z][\w-]*)=(?:"((?:\\.|[^"])*)"|([^\s]+))/g;
  let match: RegExpExecArray | null = regex.exec(input);
  while (match) {
    const key = match[1];
    const rawValue = match[2] ?? match[3] ?? '';
    attrs[key] = rawValue.replace(/\\"/g, '"');
    match = regex.exec(input);
  }
  return attrs;
}

function parseNumber(value: string | undefined): number | undefined {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseScalarValue(value: string | undefined): unknown {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return '';
  }

  if (trimmed === 'true') {
    return true;
  }

  if (trimmed === 'false') {
    return false;
  }

  if (trimmed === 'null') {
    return null;
  }

  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    const parsed = parseJson<unknown>(trimmed);
    if (parsed !== null) {
      return parsed;
    }
  }

  return trimmed;
}

function readDefaultValueAttr(attrs: Record<string, string>): unknown {
  return parseScalarValue(attrs.defaultValue ?? attrs.value);
}

function readCollectionDefaultValuesAttr(
  attrs: Record<string, string>
): Array<Record<string, unknown>> | undefined {
  const raw = attrs.defaultValues;
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return undefined;
  }

  const parsed = parseJson<unknown>(raw);
  if (!Array.isArray(parsed)) {
    return undefined;
  }

  const items = parsed.filter(
    (item): item is Record<string, unknown> =>
      Boolean(item) && typeof item === 'object' && !Array.isArray(item)
  );

  return items.length > 0 ? items : undefined;
}

function collectCollectionItemDefaultValues(
  node: DslNode
): Record<string, unknown> | undefined {
  const item: Record<string, unknown> = {};

  function visit(current: DslNode): void {
    if (
      current.type === 'group' ||
      current.type === 'row' ||
      current.type === 'grid'
    ) {
      for (const child of current.children) {
        visit(child);
      }
      return;
    }

    if (current.type === 'collection' || current.type === 'action') {
      return;
    }

    const value = readDefaultValueAttr(current.attrs);
    if (typeof value === 'undefined') {
      return;
    }

    const key = current.attrs.key ?? current.attrs.id;
    if (typeof key === 'string' && key.trim().length > 0) {
      item[key] = value;
    }
  }

  visit(node);
  return Object.keys(item).length > 0 ? item : undefined;
}

function parseOptions(value: string | undefined):
  | Array<{ value: string; label: string }>
  | undefined {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return undefined;
  }

  const items = value
    .split('|')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => {
      const separator = entry.indexOf(':');
      if (separator < 0) {
        return {
          value: entry,
          label: entry,
        };
      }
      return {
        value: entry.slice(0, separator).trim(),
        label: entry.slice(separator + 1).trim(),
      };
    })
    .filter((option) => option.value.length > 0);

  return items.length > 0 ? items : undefined;
}

function buildNodeFromDsl(
  node: DslNode,
  options?: {
    ignoreInlineDefaults?: boolean;
  }
): Record<string, unknown> {
  const attrs = node.attrs;
  const base: Record<string, unknown> = {
    id: attrs.id ?? `${node.type}_${Math.random().toString(36).slice(2, 8)}`,
    type: node.type,
  };

  if (attrs.key) base.key = attrs.key;
  if (attrs.label) base.label = attrs.label;
  if (attrs.description) base.description = attrs.description;
  if (attrs.placeholder) base.placeholder = attrs.placeholder;

  if (
    !options?.ignoreInlineDefaults &&
    node.type !== 'group' &&
    node.type !== 'row' &&
    node.type !== 'grid' &&
    node.type !== 'collection' &&
    node.type !== 'action'
  ) {
    const defaultValue = readDefaultValueAttr(attrs);
    if (typeof defaultValue !== 'undefined') {
      base.defaultValue = defaultValue;
    }
  }

  if (node.type === 'field') {
    base.dataType =
      attrs.dataType === 'number' || attrs.dataType === 'boolean'
        ? attrs.dataType
        : 'string';
  }

  if (node.type === 'presentation') {
    base.contentType = attrs.contentType === 'markdown' ? 'markdown' : 'text';
    base.content = attrs.content ?? '';
  }

  if (node.type === 'action') {
    base.intentId = attrs.intentId ?? `${String(base.id)}.submit`;
    if (!attrs.label) {
      base.label = 'Submit';
    }
  }

  if (node.type === 'grid') {
    const columns = parseNumber(attrs.columns);
    if (typeof columns === 'number') {
      base.columns = columns;
    }
  }

  if (node.type === 'group') {
    const layout = attrs.layout;
    if (
      layout === 'vertical' ||
      layout === 'horizontal' ||
      layout === 'grid'
    ) {
      base.layout = layout;
    }
    const columns = parseNumber(attrs.columns);
    if (typeof columns === 'number') {
      base.columns = columns;
    }
  }

  if (node.type === 'slider') {
    const min = parseNumber(attrs.min);
    const max = parseNumber(attrs.max);
    const step = parseNumber(attrs.step);
    if (typeof min === 'number') base.min = min;
    if (typeof max === 'number') base.max = max;
    if (typeof step === 'number') base.step = step;
  }

  if (node.type === 'select' || node.type === 'radio-group') {
    const options = parseOptions(attrs.options);
    if (options) {
      base.options = options;
    }
  }

  if (node.type === 'group' || node.type === 'row' || node.type === 'grid') {
    base.children = node.children.map((child) => buildNodeFromDsl(child));
  }

  if (node.type === 'collection') {
    const templateNode = node.children[0];
    const explicitDefaultValues = readCollectionDefaultValuesAttr(attrs);
    const derivedDefaultItem = templateNode
      ? collectCollectionItemDefaultValues(templateNode)
      : undefined;
    if (explicitDefaultValues) {
      base.defaultValues = explicitDefaultValues;
    } else if (derivedDefaultItem) {
      base.defaultValues = [derivedDefaultItem];
    }
    base.template = templateNode
      ? buildNodeFromDsl(templateNode, {
          ignoreInlineDefaults:
            Boolean(explicitDefaultValues) || Boolean(derivedDefaultItem),
        })
      : { id: `${String(base.id)}_item`, type: 'group', children: [] };
  }

  return base;
}

export function buildClaudeViewDslSystemPrompt(args: {
  mode: PromptMode;
  addons?: PromptAddon[];
}): string {
  const sections = [
    '<instructions>',
    'Return only Continuum View DSL.',
    'Do not return JSON.',
    'Do not return markdown fences.',
    'Use exactly two spaces for each indentation level.',
    'Write exactly one root line followed by one line per node.',
    'The root line format is: view viewId="..." version="..."',
    'Supported node types are: group, row, grid, collection, field, textarea, date, select, radio-group, slider, toggle, action, presentation.',
    'Every node line must include id="...".',
    'Use key="..." when semantic continuity matters.',
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
    'Do not put value/defaultValue on template fields when your goal is to prefill collection items.',
    'Keep ids unique.',
    'Prefer simple, valid structures over complex ones.',
    'Use layout structure intentionally.',
    'Prefer group for major sections and semantic clustering.',
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
    'Detached fields are previously removed fields whose user data can still be restored.',
    'Use previousLabel and previousParentLabel as semantic clues when the user asks to bring a field back.',
    'If you reintroduce the same semantic field, reuse its detachedKey as the node key even if the label changes.',
    'Do not reuse a detachedKey for a different concept just because the value looks similar.',
    args.mode === 'create-view'
      ? 'Create a brand-new view from the user request.'
      : args.mode === 'correction-loop'
        ? 'Return a corrected next view that resolves the provided errors while preserving unchanged semantics.'
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
    '  field id="full_name" key="full_name" label="Full name" dataType="string"'
  );
  sections.push('  row id="contact_row"');
  sections.push(
    '    field id="phone" key="phone" label="Phone" dataType="string"'
  );
  sections.push(
    '    date id="birth_date" key="birth_date" label="Date of birth"'
  );
  sections.push(
    '  collection id="medications" key="medications" label="Current medications" defaultValues="[{\\"medication_name\\":\\"Lisinopril\\"}]"'
  );
  sections.push('    group id="medication_item" label="Medication"');
  sections.push(
    '      field id="medication_name" key="medication_name" label="Medication name" dataType="string"'
  );
  sections.push(
    '  action id="submit_checkin" intentId="submit_checkin.submit" label="Submit"'
  );
  sections.push('</example>');
  sections.push('<example>');
  sections.push('view viewId="profile_form" version="4"');
  sections.push('group id="profile_root" label="Profile"');
  sections.push(
    '  field id="first_name" key="first_name" label="First name" dataType="string" defaultValue="Jane"'
  );
  sections.push(
    '  toggle id="newsletter" key="newsletter" label="Subscribe" defaultValue=true'
  );
  sections.push(
    '  collection id="medications" key="medications" label="Medications" defaultValues="[{\\"medication_name\\":\\"Lisinopril\\",\\"medication_dose\\":\\"10mg\\"}]"'
  );
  sections.push('    group id="medication_item" label="Medication"');
  sections.push(
    '      field id="medication_name" key="medication_name" label="Medication name" dataType="string"'
  );
  sections.push(
    '      field id="medication_dose" key="medication_dose" label="Dose" dataType="string"'
  );
  sections.push('</example>');

  return sections.join('\n');
}

export function buildClaudeViewDslUserMessage(args: {
  mode: PromptMode;
  instruction: string;
  currentView?: unknown;
  detachedFields?: unknown[];
  validationErrors?: string[];
  runtimeErrors?: string[];
}): string {
  const sections = ['<input>'];

  if (typeof args.currentView !== 'undefined') {
    sections.push(`Current view:\n${JSON.stringify(args.currentView, null, 2)}`);
  }

  if (Array.isArray(args.detachedFields)) {
    sections.push(
      'Detached fields are prior removed fields available for restoration. Match by semantic meaning using detachedKey, previousLabel, and previousParentLabel.\n' +
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
  sections.push('Output format:\nReturn only Continuum View DSL.');
  sections.push('</input>');

  return sections.join('\n\n');
}

export function parseClaudeViewDslToViewDefinition(args: {
  text: string;
  fallbackView?: ViewDefinition;
}): ViewDefinition | null {
  const asJson = parseJson<unknown>(args.text);
  if (asJson && typeof asJson === 'object') {
    const candidate = asJson as Record<string, unknown>;
    if (
      typeof candidate.viewId === 'string' &&
      typeof candidate.version === 'string' &&
      Array.isArray(candidate.nodes)
    ) {
      return candidate as unknown as ViewDefinition;
    }
  }

  const normalized = normalizeDslText(args.text);
  if (!normalized) {
    return null;
  }

  const lines = normalized
    .split(/\r?\n/)
    .map((line) => line.replace(/\t/g, '  '))
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0 || !lines[0].trim().startsWith('view ')) {
    return null;
  }

  const rootAttrs = parseAttrs(lines[0].trim().slice(5));
  const nodes: DslNode[] = [];
  const stack: Array<{ indent: number; node: DslNode }> = [];

  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index];
    const indentMatch = line.match(/^ */);
    const indent = indentMatch ? indentMatch[0].length / 2 : 0;
    const trimmed = line.trim();
    const firstSpace = trimmed.indexOf(' ');
    const typeToken =
      firstSpace >= 0 ? trimmed.slice(0, firstSpace) : trimmed;
    const rest = firstSpace >= 0 ? trimmed.slice(firstSpace + 1) : '';

    if (!(
      typeToken === 'field' ||
      typeToken === 'textarea' ||
      typeToken === 'date' ||
      typeToken === 'select' ||
      typeToken === 'radio-group' ||
      typeToken === 'slider' ||
      typeToken === 'toggle' ||
      typeToken === 'action' ||
      typeToken === 'group' ||
      typeToken === 'row' ||
      typeToken === 'grid' ||
      typeToken === 'collection' ||
      typeToken === 'presentation'
    )) {
      return null;
    }

    const node: DslNode = {
      type: typeToken,
      attrs: parseAttrs(rest),
      children: [],
    };

    while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }

    const parent = stack[stack.length - 1]?.node;
    if (!parent) {
      nodes.push(node);
    } else {
      parent.children.push(node);
    }

    if (CONTAINER_TYPES.has(node.type)) {
      stack.push({ indent, node });
    }
  }

  const fallbackView = args.fallbackView;
  const viewId = rootAttrs.viewId ?? fallbackView?.viewId ?? 'generated_view';
  const version =
    rootAttrs.version ??
    (fallbackView ? bumpVersion(fallbackView.version) : '1');

  return {
    viewId,
    version,
    nodes: nodes.map((node) => buildNodeFromDsl(node)) as unknown as ViewDefinition['nodes'],
  };
}
