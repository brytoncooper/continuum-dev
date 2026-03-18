import type { ViewDefinition } from '@continuum-dev/core';
import {
  collectCandidateViewErrors,
  normalizeGeneratedView,
} from './normalize.js';

function createCurrentView(): ViewDefinition {
  return {
    viewId: 'profile',
    version: '1',
    nodes: [
      {
        id: 'profile_group',
        type: 'group',
        label: 'Profile',
        children: [
          {
            id: 'email',
            type: 'field',
            key: 'person.email',
            semanticKey: 'person.email',
            label: 'Email',
            dataType: 'string',
          },
        ],
      },
    ],
  };
}

describe('view generation normalization', () => {
  it('reports a compile error when the candidate is not a view definition', () => {
    expect(collectCandidateViewErrors(createCurrentView(), null)).toEqual([
      'Model output did not compile into a valid ViewDefinition.',
    ]);
  });

  it('returns a normalized valid view', () => {
    const normalized = normalizeGeneratedView(createCurrentView(), {
      viewId: 'profile',
      version: '2',
      nodes: [
        {
          id: 'profile_group',
          type: 'group',
          label: 'Profile',
          children: [
            {
              id: 'email',
              type: 'field',
              key: 'person.email',
              semanticKey: 'person.email',
              label: 'Email',
              dataType: 'string',
            },
            {
              id: 'phone',
              type: 'field',
              key: 'person.phone',
              semanticKey: 'person.phone',
              label: 'Phone',
              dataType: 'string',
            },
          ],
        },
      ],
    });

    expect(normalized).toMatchObject({
      viewId: 'profile',
      version: '2',
      nodes: [
        {
          id: 'profile_group',
          children: [
            { id: 'email' },
            { id: 'phone' },
          ],
        },
      ],
    });
  });

  it('throws when the generated view contains unsupported node types', () => {
    expect(() =>
      normalizeGeneratedView(
        {
          viewId: 'empty',
          version: '1',
          nodes: [],
        },
        {
          viewId: 'empty',
          version: '2',
          nodes: [
            {
              id: 'bad',
              type: 'unknown-node',
            },
          ],
        } as unknown as ViewDefinition
      )
    ).toThrow('Unsupported node types returned: unknown-node.');
  });
});
