import { describe, expect, it } from 'vitest';
import { buildStarterKitStateTargetCatalog } from './catalog.js';
import { parseStarterKitStateResponse } from './parser.js';

const targetCatalog = [
  {
    nodeId: 'profile/email',
    key: 'person.email',
    semanticKey: 'person.email',
    nodeType: 'field',
    dataType: 'string',
  },
  {
    nodeId: 'profile/opt_in',
    key: 'person.optIn',
    semanticKey: 'person.optIn',
    nodeType: 'toggle',
  },
  {
    nodeId: 'profile/age',
    key: 'person.age',
    semanticKey: 'person.age',
    nodeType: 'field',
    dataType: 'number',
  },
  {
    nodeId: 'profile/status',
    key: 'person.status',
    semanticKey: 'person.status',
    nodeType: 'select',
    options: [
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' },
    ],
  },
  {
    nodeId: 'profile/dependents',
    key: 'person.dependents',
    semanticKey: 'person.dependents',
    nodeType: 'collection',
    templateFields: [
      {
        nodeId: 'profile/dependents/dependent/name',
        key: 'dependent.name',
        semanticKey: 'dependent.name',
        nodeType: 'field',
        dataType: 'string',
      },
      {
        nodeId: 'profile/dependents/dependent/age',
        key: 'dependent.age',
        semanticKey: 'dependent.age',
        nodeType: 'field',
        dataType: 'number',
      },
      {
        nodeId: 'profile/dependents/dependent/relationship',
        key: 'dependent.relationship',
        semanticKey: 'dependent.relationship',
        nodeType: 'radio-group',
        options: [
          { value: 'child', label: 'Child' },
          { value: 'spouse', label: 'Spouse' },
        ],
      },
    ],
  },
];

describe('execution target state response parsing', () => {
  it('parses scalar updates arrays and resolves targets by node id, semantic key, or key', () => {
    const parsed = parseStarterKitStateResponse({
      text: JSON.stringify({
        updates: [
          {
            semanticKey: 'person.email',
            value: 'jordan@example.com',
          },
          {
            key: 'person.optIn',
            value: 'yes',
          },
          {
            nodeId: 'profile/age',
            value: '$1,234.50',
          },
          {
            key: 'person.status',
            value: 'Inactive',
          },
        ],
        status: '  Updated profile  ',
      }),
      targetCatalog,
    });

    expect(parsed).toEqual({
      updates: [
        {
          nodeId: 'profile/email',
          value: { value: 'jordan@example.com' },
        },
        {
          nodeId: 'profile/opt_in',
          value: { value: true },
        },
        {
          nodeId: 'profile/age',
          value: { value: 1234.5 },
        },
        {
          nodeId: 'profile/status',
          value: { value: 'inactive' },
        },
      ],
      status: 'Updated profile',
    });
  });

  it('parses object-shaped values payloads using the key as the target reference', () => {
    const parsed = parseStarterKitStateResponse({
      text: JSON.stringify({
        values: {
          'person.email': 'ava@example.com',
          'person.optIn': 'off',
        },
      }),
      targetCatalog,
    });

    expect(parsed).toEqual({
      updates: [
        {
          nodeId: 'profile/email',
          value: { value: 'ava@example.com' },
        },
        {
          nodeId: 'profile/opt_in',
          value: { value: false },
        },
      ],
      status: undefined,
    });
  });

  it('parses collection updates and ignores unknown or empty item fields', () => {
    const parsed = parseStarterKitStateResponse({
      text: JSON.stringify({
        updates: [
          {
            semanticKey: 'person.dependents',
            value: {
              items: [
                {
                  values: {
                    'dependent.name': 'Ava',
                    'dependent.age': '12',
                    'dependent.relationship': 'Child',
                    unknown: 'skip',
                  },
                },
                {
                  values: {
                    'dependent.name': 'Ben',
                    'dependent.relationship': 'Spouse',
                  },
                },
                {
                  values: {
                    unknown: 'skip',
                  },
                },
              ],
            },
          },
        ],
      }),
      targetCatalog,
    });

    expect(parsed).toEqual({
      updates: [
        {
          nodeId: 'profile/dependents',
          value: {
            value: {
              items: [
                {
                  values: {
                    'profile/dependents/dependent/name': { value: 'Ava' },
                    'profile/dependents/dependent/age': { value: 12 },
                    'profile/dependents/dependent/relationship': {
                      value: 'child',
                    },
                  },
                },
                {
                  values: {
                    'profile/dependents/dependent/name': { value: 'Ben' },
                    'profile/dependents/dependent/relationship': {
                      value: 'spouse',
                    },
                  },
                },
              ],
            },
          },
        },
      ],
      status: undefined,
    });
  });

  it('works with collection template references from the real state catalog builder', () => {
    const view = {
      viewId: 'household',
      version: '1',
      nodes: [
        {
          id: 'household_group',
          type: 'group',
          children: [
            {
              id: 'dependents',
              type: 'collection',
              key: 'person.dependents',
              semanticKey: 'person.dependents',
              template: {
                id: 'dependent',
                type: 'group',
                children: [
                  {
                    id: 'name',
                    type: 'field',
                    dataType: 'string',
                    key: 'dependent.name',
                    semanticKey: 'person.dependentName',
                  },
                  {
                    id: 'relationship',
                    type: 'radio-group',
                    key: 'dependent.relationship',
                    semanticKey: 'person.dependentRelationship',
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

    const catalog = buildStarterKitStateTargetCatalog(view);

    expect(catalog).toEqual([
      {
        nodeId: 'household_group/dependents',
        key: 'person.dependents',
        semanticKey: 'person.dependents',
        nodeType: 'collection',
        label: undefined,
        templateFields: [
          {
            nodeId: 'dependent/name',
            key: 'dependent.name',
            semanticKey: 'person.dependentName',
            nodeType: 'field',
            label: undefined,
            dataType: 'string',
            options: undefined,
          },
          {
            nodeId: 'dependent/relationship',
            key: 'dependent.relationship',
            semanticKey: 'person.dependentRelationship',
            nodeType: 'radio-group',
            label: undefined,
            dataType: undefined,
            options: [
              { value: 'child', label: 'Child' },
              { value: 'spouse', label: 'Spouse' },
            ],
          },
        ],
      },
    ]);

    const parsed = parseStarterKitStateResponse({
      text: JSON.stringify({
        updates: [
          {
            semanticKey: 'person.dependents',
            value: {
              items: [
                {
                  values: {
                    'dependent/name': 'Ava',
                    'person.dependentRelationship': 'Spouse',
                  },
                },
                {
                  values: {
                    'dependent.name': 'Ben',
                    'dependent/relationship': 'Child',
                  },
                },
              ],
            },
          },
        ],
        status: 'Updated dependents',
      }),
      targetCatalog: catalog,
    });

    expect(parsed).toEqual({
      updates: [
        {
          nodeId: 'household_group/dependents',
          value: {
            value: {
              items: [
                {
                  values: {
                    'dependent/name': { value: 'Ava' },
                    'dependent/relationship': { value: 'spouse' },
                  },
                },
                {
                  values: {
                    'dependent/name': { value: 'Ben' },
                    'dependent/relationship': { value: 'child' },
                  },
                },
              ],
            },
          },
        },
      ],
      status: 'Updated dependents',
    });
  });

  it('returns null when the payload is invalid or contains no valid updates', () => {
    expect(
      parseStarterKitStateResponse({
        text: '{"updates":',
        targetCatalog,
      })
    ).toBeNull();

    expect(
      parseStarterKitStateResponse({
        text: JSON.stringify({
          updates: [
            {
              key: 'person.unknown',
              value: 'skip me',
            },
          ],
        }),
        targetCatalog,
      })
    ).toBeNull();
  });
});
