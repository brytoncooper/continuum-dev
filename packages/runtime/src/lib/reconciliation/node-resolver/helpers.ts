import type { ViewNode } from '@continuum-dev/contract';
import type { ReconciliationContext } from '../../context/index.js';

const CONTAINER_TYPES = new Set(['row', 'grid', 'group']);

export function readNodeLabel(node: ViewNode | undefined): string | undefined {
  if (!node || typeof node !== 'object') {
    return undefined;
  }

  const label = 'label' in node ? node.label : undefined;
  return typeof label === 'string' && label.trim().length > 0 ? label : undefined;
}

export function readParentLabel(
  ctx: ReconciliationContext,
  scopedNodeId: string
): string | undefined {
  const separator = scopedNodeId.lastIndexOf('/');
  if (separator < 0) {
    return undefined;
  }

  return readNodeLabel(ctx.priorById.get(scopedNodeId.slice(0, separator)));
}

export function areCompatibleContainerTypes(a: string, b: string): boolean {
  return CONTAINER_TYPES.has(a) && CONTAINER_TYPES.has(b);
}

export function isProtectedValue(value: { isDirty?: boolean; isSticky?: boolean }): boolean {
  return value.isDirty === true || value.isSticky === true;
}

export function hasNodeHashChanged(priorNode: ViewNode, newNode: ViewNode): boolean {
  return !!(priorNode.hash && newNode.hash && priorNode.hash !== newNode.hash);
}

export function areDefaultValuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
      return false;
    }

    for (let index = 0; index < a.length; index += 1) {
      if (!areDefaultValuesEqual(a[index], b[index])) {
        return false;
      }
    }

    return true;
  }

  if (isPlainObject(a) && isPlainObject(b)) {
    const aKeys = Object.keys(a).sort();
    const bKeys = Object.keys(b).sort();
    if (aKeys.length !== bKeys.length) {
      return false;
    }

    for (let index = 0; index < aKeys.length; index += 1) {
      const key = aKeys[index];
      if (key !== bKeys[index] || !areDefaultValuesEqual(a[key], b[key])) {
        return false;
      }
    }

    return true;
  }

  return false;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
