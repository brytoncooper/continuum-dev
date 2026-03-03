export const VIEW_SCHEMA = {
  type: 'object',
  properties: {
    viewId: { type: 'string' },
    version: { type: 'string' },
    nodes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          type: { type: 'string' },
          key: { type: 'string' },
          label: { type: 'string' },
          dataType: { type: 'string' }
        },
        required: ['id', 'type', 'key']
      }
    }
  },
  required: ['viewId', 'version', 'nodes']
};
