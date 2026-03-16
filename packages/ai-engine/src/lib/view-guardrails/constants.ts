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

export const SUPPORTED_NODE_TYPES = new Set<string>(SUPPORTED_NODE_TYPE_VALUES);
