import type { ViewDefinition } from '@continuum-dev/core';

export const SUPPORTED_NODE_TYPE_VALUES = [
  'field',
  'textarea',
  'date',
  'select',
  'radio-group',
  'slider',
  'toggle',
  'action',
  'group',
  'row',
  'grid',
  'collection',
  'presentation',
] as const;

const SUPPORTED_NODE_TYPES = new Set<string>(SUPPORTED_NODE_TYPE_VALUES);

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

function extractJsonCandidate(text: string): string | null {
  const start = text.search(/[[{]/);
  if (start < 0) {
    return null;
  }

  const stack: string[] = [];
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{') {
      stack.push('}');
      continue;
    }

    if (char === '[') {
      stack.push(']');
      continue;
    }

    if (char === '}' || char === ']') {
      const expected = stack.pop();
      if (expected !== char) {
        return null;
      }
      if (stack.length === 0) {
        return text.slice(start, index + 1);
      }
    }
  }

  return null;
}

export function parseJson<T>(text: string): T | null {
  const candidates = [text, stripCodeFences(text)];

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as T;
    } catch {
      const extracted = extractJsonCandidate(candidate);
      if (!extracted) {
        continue;
      }
      try {
        return JSON.parse(extracted) as T;
      } catch {
        continue;
      }
    }
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export function isViewDefinition(value: unknown): value is ViewDefinition {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.viewId === 'string' &&
    typeof candidate.version === 'string' &&
    Array.isArray(candidate.nodes)
  );
}

export function collectUnsupportedNodeTypes(nodes: unknown[]): string[] {
  const unsupported = new Set<string>();

  function visit(node: unknown): void {
    if (!node || typeof node !== 'object') {
      return;
    }

    const asRecord = node as Record<string, unknown>;
    const type = asRecord.type;
    if (typeof type === 'string' && !SUPPORTED_NODE_TYPES.has(type)) {
      unsupported.add(type);
    }

    if (Array.isArray(asRecord.children)) {
      for (const child of asRecord.children) {
        visit(child);
      }
    }

    if (asRecord.template && typeof asRecord.template === 'object') {
      visit(asRecord.template);
    }
  }

  for (const node of nodes) {
    visit(node);
  }

  return [...unsupported];
}

export function collectStructuralErrors(nodes: unknown[]): string[] {
  const errors: string[] = [];
  const seenIds = new Set<string>();

  function visit(node: unknown, path: string): void {
    if (!node || typeof node !== 'object') {
      errors.push(`${path} is not an object node.`);
      return;
    }

    const asRecord = node as Record<string, unknown>;
    const type = asRecord.type;
    const id = asRecord.id;

    if (typeof id !== 'string' || id.trim().length === 0) {
      errors.push(`${path} is missing a valid id.`);
    } else if (seenIds.has(id)) {
      errors.push(`${path} uses duplicate id "${id}".`);
    } else {
      seenIds.add(id);
    }

    if (typeof type !== 'string' || !SUPPORTED_NODE_TYPES.has(type)) {
      errors.push(`${path} has unsupported type "${String(type)}".`);
      return;
    }

    if (type === 'group' || type === 'row' || type === 'grid') {
      if (!Array.isArray(asRecord.children)) {
        errors.push(`${path} (${String(type)}) is missing children[].`);
      } else {
        for (let index = 0; index < asRecord.children.length; index += 1) {
          visit(asRecord.children[index], `${path}.children[${index}]`);
        }
      }
    }

    if (type === 'collection') {
      const template = asRecord.template;
      if (!template || typeof template !== 'object') {
        errors.push(`${path} (collection) is missing template node.`);
      } else {
        visit(template, `${path}.template`);
      }
    }
  }

  for (let index = 0; index < nodes.length; index += 1) {
    visit(nodes[index], `nodes[${index}]`);
  }

  return errors;
}

function makeUniqueId(baseId: string, usedIds: Set<string>): string {
  let candidate = baseId || 'node';
  let index = 2;
  while (usedIds.has(candidate)) {
    candidate = `${baseId || 'node'}_${index}`;
    index += 1;
  }
  usedIds.add(candidate);
  return candidate;
}

function normalizeNode(
  input: unknown,
  usedIds: Set<string>
): Record<string, unknown> {
  const source = (input && typeof input === 'object'
    ? (input as Record<string, unknown>)
    : {}) as Record<string, unknown>;
  const type = typeof source.type === 'string' ? source.type : 'presentation';
  const normalized: Record<string, unknown> = { ...source, type };

  normalized.id = makeUniqueId(
    typeof source.id === 'string' ? source.id : 'node',
    usedIds
  );

  if (type === 'field' && typeof source.dataType !== 'string') {
    normalized.dataType = 'string';
  }

  if (type === 'action') {
    if (typeof source.intentId !== 'string' || source.intentId.trim().length === 0) {
      normalized.intentId = `${String(normalized.id)}.submit`;
    }
    if (typeof source.label !== 'string' || source.label.trim().length === 0) {
      normalized.label = 'Submit';
    }
  }

  if (type === 'presentation') {
    if (
      typeof source.contentType !== 'string' ||
      (source.contentType !== 'text' && source.contentType !== 'markdown')
    ) {
      normalized.contentType = 'text';
    }
    if (typeof source.content !== 'string') {
      normalized.content = '';
    }
  }

  if (type === 'group' || type === 'row' || type === 'grid') {
    const children = Array.isArray(source.children)
      ? source.children
      : source.template && typeof source.template === 'object'
        ? [source.template]
        : [];
    normalized.children = children.map((child) => normalizeNode(child, usedIds));
    delete normalized.template;
  }

  if (type === 'collection') {
    const templateSource =
      source.template && typeof source.template === 'object'
        ? source.template
        : { id: `${String(normalized.id)}_item`, type: 'group', children: [] };
    normalized.template = normalizeNode(templateSource, usedIds);
  }

  return normalized;
}

export function normalizeViewDefinition(view: ViewDefinition): ViewDefinition {
  const usedIds = new Set<string>();
  return {
    viewId: view.viewId,
    version: view.version,
    nodes: (Array.isArray(view.nodes) ? view.nodes : []).map((node) =>
      normalizeNode(node, usedIds)
    ) as unknown as ViewDefinition['nodes'],
  };
}

export function buildRuntimeErrors(issues: unknown[]): string[] {
  return issues.map((issue) => {
    if (!issue || typeof issue !== 'object') {
      return String(issue);
    }
    const asRecord = issue as Record<string, unknown>;
    if (typeof asRecord.message === 'string') {
      return asRecord.message;
    }
    return JSON.stringify(issue);
  });
}
