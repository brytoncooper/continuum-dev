import {
  collectStructuralErrors,
  collectUnsupportedNodeTypes,
} from './structural.js';

describe('view structural guardrails', () => {
  it('finds unsupported node types anywhere in the tree and de-duplicates them', () => {
    const nodes = [
      {
        id: 'profile_group',
        type: 'group',
        children: [
          {
            id: 'wizard_step',
            type: 'wizard',
          },
        ],
      },
      {
        id: 'dependents',
        type: 'collection',
        template: {
          id: 'dependent',
          type: 'carousel',
        },
      },
      {
        id: 'wizard_again',
        type: 'wizard',
      },
    ];

    expect(collectUnsupportedNodeTypes(nodes)).toEqual(['wizard', 'carousel']);
    expect(collectStructuralErrors(nodes)).toContain(
      'nodes[0].children[0] has unsupported type "wizard".'
    );
    expect(collectStructuralErrors(nodes)).toContain(
      'nodes[1].template has unsupported type "carousel".'
    );
  });

  it('reports precise paths for malformed descendants and duplicate ids across branches', () => {
    const errors = collectStructuralErrors([
      {
        id: 'profile_group',
        type: 'group',
        children: [
          null,
          {
            id: 'email',
            type: 'field',
            key: 'person.email',
          },
        ],
      },
      {
        id: 'dependents',
        type: 'collection',
        template: {
          id: 'dependent',
          type: 'group',
          children: [
            {
              id: 'email',
              type: 'field',
              key: 'dependent.email',
            },
          ],
        },
      },
    ]);

    expect(errors).toContain('nodes[0].children[0] is not an object node.');
    expect(errors).toContain(
      'nodes[1].template.children[0] uses duplicate id "email".'
    );
  });
});
