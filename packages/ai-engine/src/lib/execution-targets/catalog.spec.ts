import { describe, expect, it } from 'vitest';
import {
  buildStarterKitPatchTargetCatalog,
  buildStarterKitStateTargetCatalog,
} from './catalog.js';

const view = {
  viewId: 'profile',
  version: '1',
  nodes: [
    {
      id: 'profile_group',
      type: 'group',
      label: 'Profile',
      children: [
        {
          id: 'full_name',
          type: 'field',
          key: 'person.fullName',
          semanticKey: 'person.fullName',
          label: 'Full name',
          dataType: 'string',
        },
        {
          id: 'contact_row',
          type: 'row',
          children: [
            {
              id: 'status',
              type: 'select',
              key: 'person.status',
              semanticKey: 'person.status',
              label: 'Status',
              options: [
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
              ],
            },
          ],
        },
        {
          id: 'dependents',
          type: 'collection',
          key: 'person.dependents',
          semanticKey: 'person.dependents',
          label: 'Dependents',
          template: {
            id: 'dependent',
            type: 'group',
            children: [
              {
                id: 'name',
                type: 'field',
                dataType: 'string',
                key: 'dependent.name',
                semanticKey: 'dependent.name',
                label: 'Name',
              },
              {
                id: 'relationship',
                type: 'radio-group',
                key: 'dependent.relationship',
                semanticKey: 'dependent.relationship',
                label: 'Relationship',
                options: [
                  { value: 'child', label: 'Child' },
                  { value: 'spouse', label: 'Spouse' },
                ],
              },
            ],
          },
        },
      ],
    },
  ],
};

describe('execution target catalog builders', () => {
  it('builds a state catalog with canonical ids and collection template fields', () => {
    expect(buildStarterKitStateTargetCatalog(view)).toEqual([
      {
        nodeId: 'profile_group/full_name',
        key: 'person.fullName',
        semanticKey: 'person.fullName',
        nodeType: 'field',
        label: 'Full name',
        dataType: 'string',
        options: undefined,
      },
      {
        nodeId: 'profile_group/contact_row/status',
        key: 'person.status',
        semanticKey: 'person.status',
        nodeType: 'select',
        label: 'Status',
        dataType: undefined,
        options: [
          { value: 'active', label: 'Active' },
          { value: 'inactive', label: 'Inactive' },
        ],
      },
      {
        nodeId: 'profile_group/dependents',
        key: 'person.dependents',
        semanticKey: 'person.dependents',
        nodeType: 'collection',
        label: 'Dependents',
        templateFields: [
          {
            nodeId: 'dependent/name',
            key: 'dependent.name',
            semanticKey: 'dependent.name',
            nodeType: 'field',
            label: 'Name',
            dataType: 'string',
            options: undefined,
          },
          {
            nodeId: 'dependent/relationship',
            key: 'dependent.relationship',
            semanticKey: 'dependent.relationship',
            nodeType: 'radio-group',
            label: 'Relationship',
            dataType: undefined,
            options: [
              { value: 'child', label: 'Child' },
              { value: 'spouse', label: 'Spouse' },
            ],
          },
        ],
      },
    ]);
  });

  it('builds a patch catalog for every node using raw ids instead of canonical ids', () => {
    expect(buildStarterKitPatchTargetCatalog(view)).toEqual([
      {
        nodeId: 'profile_group',
        key: undefined,
        semanticKey: undefined,
        nodeType: 'group',
        label: 'Profile',
      },
      {
        nodeId: 'full_name',
        key: 'person.fullName',
        semanticKey: 'person.fullName',
        nodeType: 'field',
        label: 'Full name',
      },
      {
        nodeId: 'contact_row',
        key: undefined,
        semanticKey: undefined,
        nodeType: 'row',
        label: undefined,
      },
      {
        nodeId: 'status',
        key: 'person.status',
        semanticKey: 'person.status',
        nodeType: 'select',
        label: 'Status',
      },
      {
        nodeId: 'dependents',
        key: 'person.dependents',
        semanticKey: 'person.dependents',
        nodeType: 'collection',
        label: 'Dependents',
      },
      {
        nodeId: 'dependent',
        key: undefined,
        semanticKey: undefined,
        nodeType: 'group',
        label: undefined,
      },
      {
        nodeId: 'name',
        key: 'dependent.name',
        semanticKey: 'dependent.name',
        nodeType: 'field',
        label: 'Name',
      },
      {
        nodeId: 'relationship',
        key: 'dependent.relationship',
        semanticKey: 'dependent.relationship',
        nodeType: 'radio-group',
        label: 'Relationship',
      },
    ]);
  });
});
