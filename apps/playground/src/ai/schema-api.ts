export interface NodeTypeSpec {
  type: string;
  description: string;
  requires: string[];       // required fields
  optional: string[];       // optional fields with brief descriptions
  example: Record<string, unknown>;
}

export const NODE_TYPE_SPECS: Record<string, NodeTypeSpec> = {
  field: {
    type: 'field',
    description: 'text/number/boolean input',
    requires: ['dataType'],
    optional: ['label', 'placeholder', 'defaultValue'],
    example: { type: 'field', id: 'name', key: 'name', dataType: 'string', label: 'Full Name' }
  },
  textarea: {
    type: 'textarea',
    description: 'multiline string input',
    requires: [],
    optional: ['label', 'placeholder', 'defaultValue'],
    example: { type: 'textarea', id: 'bio', key: 'bio', label: 'Biography' }
  },
  date: {
    type: 'date',
    description: 'date input (value format YYYY-MM-DD string)',
    requires: [],
    optional: ['label', 'placeholder', 'defaultValue'],
    example: { type: 'date', id: 'dob', key: 'dob', label: 'Date of Birth' }
  },
  select: {
    type: 'select',
    description: 'single-choice dropdown. Include options: [{ value, label }]',
    requires: ['options'],
    optional: ['label', 'placeholder', 'defaultValue'],
    example: { type: 'select', id: 'role', key: 'role', options: [{ value: 'admin', label: 'Admin' }] }
  },
  'radio-group': {
    type: 'radio-group',
    description: 'single-choice radio options. Include options: [{ value, label }]',
    requires: ['options'],
    optional: ['label', 'defaultValue'],
    example: { type: 'radio-group', id: 'plan', key: 'plan', options: [{ value: 'free', label: 'Free' }] }
  },
  slider: {
    type: 'slider',
    description: 'numeric range input. Include props: { min, max }.',
    requires: ['min', 'max'],
    optional: ['label', 'defaultValue', 'step'],
    example: { type: 'slider', id: 'rating', key: 'rating', min: 1, max: 5 }
  },
  toggle: {
    type: 'toggle',
    description: 'boolean switch',
    requires: [],
    optional: ['label', 'defaultValue'],
    example: { type: 'toggle', id: 'agree', key: 'agree', label: 'I Agree' }
  },
  action: {
    type: 'action',
    description: 'button trigger',
    requires: ['intentId', 'label'],
    optional: [],
    example: { type: 'action', id: 'submit-btn', key: 'submit', intentId: 'submit', label: 'Submit Form' }
  },
  group: {
    type: 'group',
    description: 'Vertical container for nested nodes',
    requires: ['children'],
    optional: ['label'],
    example: { type: 'group', id: 'user-info', key: 'user-info', children: [] }
  },
  row: {
    type: 'row',
    description: 'horizontal layout container to place fields side-by-side',
    requires: ['children'],
    optional: [],
    example: { type: 'row', id: 'name-row', key: 'name-row', children: [] }
  },
  grid: {
    type: 'grid',
    description: 'grid layout container. Can specify columns: number (default 2)',
    requires: ['children'],
    optional: ['columns'],
    example: { type: 'grid', id: 'address-grid', key: 'address', columns: 2, children: [] }
  },
  collection: {
    type: 'collection',
    description: 'repeatable group',
    requires: ['template'],
    optional: ['label', 'defaultValues'],
    example: { type: 'collection', id: 'items', key: 'items', template: { type: 'field', id: 'item', key: 'item', dataType: 'string' } }
  },
  presentation: {
    type: 'presentation',
    description: 'static text/markdown',
    requires: ['contentType', 'content'],
    optional: [],
    example: { type: 'presentation', id: 'intro', key: 'intro', contentType: 'markdown', content: '# Hello' }
  }
};

export function getSchemaIndex(): { types: string[]; endpointTemplate: string } {
  return {
    types: Object.keys(NODE_TYPE_SPECS),
    endpointTemplate: '/api/schema/{nodeType}'
  };
}

export function getNodeSpec(type: string): NodeTypeSpec | null {
  return NODE_TYPE_SPECS[type] || null;
}
