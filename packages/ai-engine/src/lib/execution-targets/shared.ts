import type { ViewNode } from '@continuum-dev/contract';

export const SCALAR_STATEFUL_NODE_TYPES = new Set([
  'field',
  'textarea',
  'date',
  'select',
  'radio-group',
  'slider',
  'toggle',
]);

export function toCanonicalNodeId(nodeId: string, parentPath = ''): string {
  return parentPath ? `${parentPath}/${nodeId}` : nodeId;
}

export function readNodeLabel(node: ViewNode): string | undefined {
  return 'label' in node && typeof node.label === 'string'
    ? node.label
    : undefined;
}
