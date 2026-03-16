export type ViewLineDslNodeType =
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

export interface ViewLineDslNode {
  type: ViewLineDslNodeType;
  attrs: Record<string, string>;
  children: ViewLineDslNode[];
}

const NODE_TYPES = new Set<ViewLineDslNodeType>([
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
]);

export const CONTAINER_NODE_TYPES = new Set<ViewLineDslNodeType>([
  'group',
  'row',
  'grid',
  'collection',
]);

export function isViewLineDslNodeType(
  value: string
): value is ViewLineDslNodeType {
  return NODE_TYPES.has(value as ViewLineDslNodeType);
}
