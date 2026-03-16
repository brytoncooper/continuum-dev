import { SUPPORTED_NODE_TYPES } from './constants.js';

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
