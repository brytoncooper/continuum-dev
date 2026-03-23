import type { ViewDefinition } from '@continuum-dev/starter-kit';

export const baselineView: ViewDefinition = {
  viewId: 'starter_baseline',
  version: '1',
  nodes: [
    {
      id: 'workspace',
      type: 'group',
      key: 'workspace',
      label: 'Workspace',
      children: [
        {
          id: 'title',
          type: 'field',
          dataType: 'string',
          key: 'title',
          label: 'Title',
        },
        {
          id: 'name',
          type: 'field',
          dataType: 'string',
          key: 'name',
          label: 'Name',
        },
        {
          id: 'email',
          type: 'field',
          dataType: 'string',
          key: 'email',
          label: 'Email',
        },
        {
          id: 'notes',
          type: 'field',
          dataType: 'string',
          key: 'notes',
          label: 'Notes',
        },
      ],
    },
  ],
};
