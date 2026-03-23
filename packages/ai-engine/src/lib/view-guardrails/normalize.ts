import type { ViewDefinition } from '@continuum-dev/core';

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
  const source = (
    input && typeof input === 'object' ? (input as Record<string, unknown>) : {}
  ) as Record<string, unknown>;
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
    if (
      typeof source.intentId !== 'string' ||
      source.intentId.trim().length === 0
    ) {
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
    normalized.children = children.map((child) =>
      normalizeNode(child, usedIds)
    );
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
