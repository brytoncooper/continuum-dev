import type { ViewDefinition } from '@continuum/contract';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

type AnyNode = Record<string, unknown>;

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function validateNode(node: AnyNode, path: string, errors: string[]): void {
  const id = typeof node.id === 'string' ? node.id : '';
  const type = typeof node.type === 'string' ? node.type : '';

  if (!id) {
    errors.push(`Missing node id at ${path}`);
  }
  if (!type) {
    errors.push(`Missing node type at ${path}`);
  }

  if (type === 'field') {
    if (
      typeof node.dataType !== 'string' ||
      !['string', 'number', 'boolean'].includes(node.dataType)
    ) {
      errors.push(`Invalid field dataType at ${path}/${id}`);
    }
    if (node.options && !Array.isArray(node.options)) {
      errors.push(`Field options must be an array at ${path}/${id}`);
    }
  }

  if (type === 'select' || type === 'radio-group') {
    if (!Array.isArray(node.options)) {
      errors.push(`${type} options must be an array at ${path}/${id}`);
    }
  }

  if (type === 'action') {
    if (typeof node.intentId !== 'string' || node.intentId.length === 0) {
      errors.push(`Action intentId is required at ${path}/${id}`);
    }
    if (typeof node.label !== 'string' || node.label.length === 0) {
      errors.push(`Action label is required at ${path}/${id}`);
    }
  }

  if (type === 'presentation') {
    if (
      typeof node.contentType !== 'string' ||
      !['text', 'markdown'].includes(node.contentType)
    ) {
      errors.push(`Presentation contentType is invalid at ${path}/${id}`);
    }
    if (typeof node.content !== 'string') {
      errors.push(`Presentation content must be a string at ${path}/${id}`);
    }
  }

  if (type === 'group') {
    if (!Array.isArray(node.children)) {
      errors.push(`Group children must be an array at ${path}/${id}`);
    } else {
      for (const child of node.children as unknown[]) {
        if (isObject(child)) {
          validateNode(child, `${path}/${id}`, errors);
        }
      }
    }
  }

  if (type === 'collection') {
    if (!node.template || !isObject(node.template)) {
      errors.push(`Collection template is required at ${path}/${id}`);
    } else {
      validateNode(node.template as AnyNode, `${path}/${id}/template`, errors);
    }
  }
}

export function validateView(view: unknown): string[] {
  const errors: string[] = [];
  if (!isObject(view)) {
    return ['View payload must be an object'];
  }

  const typedView = view as unknown as ViewDefinition;
  if (!typedView.viewId) {
    errors.push('Missing viewId');
  }
  if (!typedView.version) {
    errors.push('Missing version');
  }
  if (!Array.isArray(typedView.nodes)) {
    errors.push('nodes must be an array');
    return errors;
  }

  const ids = new Set<string>();
  const keys = new Set<string>();
  const walkForIdentity = (node: AnyNode, path: string) => {
    const nodeId = typeof node.id === 'string' ? node.id : '';
    const nodeKey = typeof node.key === 'string' ? node.key : '';
    const nodeType = typeof node.type === 'string' ? node.type : '';
    const idRef = `${path}/${nodeId}`;
    if (ids.has(idRef)) {
      errors.push(`Duplicate node path id: ${idRef}`);
    }
    ids.add(idRef);
    if (nodeKey) {
      const keyRef = `${path}/${nodeKey}`;
      if (keys.has(keyRef)) {
        errors.push(`Duplicate node path key: ${keyRef}`);
      }
      keys.add(keyRef);
    }

    if (nodeType === 'group') {
      for (const child of asArray(node.children)) {
        if (isObject(child)) {
          walkForIdentity(child, `${path}/${nodeId}`);
        }
      }
    }
    if (nodeType === 'collection' && isObject(node.template)) {
      walkForIdentity(node.template, `${path}/${nodeId}/template`);
    }
  };

  for (const node of typedView.nodes as unknown[]) {
    if (!isObject(node)) {
      errors.push('Each node must be an object');
      continue;
    }
    validateNode(node, 'root', errors);
    walkForIdentity(node, 'root');
  }

  return errors;
}
